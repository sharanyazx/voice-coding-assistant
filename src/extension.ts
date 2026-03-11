// ============================================================================
// Voice Coding Assistant — Main Extension Entry Point
// ============================================================================
//
// This is the heart of the extension. VS Code calls activate() when the
// extension starts and deactivate() when it shuts down.
//
// ARCHITECTURE OVERVIEW (Updated):
//
//   ┌─────────────┐
//   │  Microphone  │
//   └──────┬──────┘
//          │
//   ┌──────▼────────────────────────────────────────────────────┐
//   │  Voice Mode Manager (voiceModeManager.ts)                 │
//   │  ┌──────────────┐           ┌───────────────┐            │
//   │  │ PASSIVE MODE │ wake word │  ACTIVE MODE  │            │
//   │  │ (3s clips)   ├──────────▶│ (7s clips)    │            │
//   │  │ Wake word    │◀──────────┤ Commands      │            │
//   │  │ detection    │ deactivate│ processed     │            │
//   │  └──────────────┘  or       └───────┬───────┘            │
//   │                    timeout          │                     │
//   └─────────────────────────────────────┼─────────────────────┘
//                                         │
//   ┌──────────────┐  ┌─────────▼────────┐  ┌───────────────┐
//   │  Whisper STT │  │  Command Parser  │  │  AI Engine    │
//   └──────────────┘  └────────┬─────────┘  └───────────────┘
//                              │
//   ┌──────────────┐  ┌───────▼──────────┐  ┌───────────────┐
//   │  Voice TTS   │  │  VS Code         │  │  Safety       │
//   │  Feedback    │◀─┤  Controller      │  │  Confirmation │
//   └──────────────┘  └──────────────────┘  └───────────────┘
//
// COMMANDS REGISTERED:
//   1. voice-coding-assistant.helloWorld           → Test
//   2. voice-coding-assistant.startListening       → Single voice command
//   3. voice-coding-assistant.stopListening        → Stop recording
//   4. voice-coding-assistant.typeCommand          → Manual text input
//   5. voice-coding-assistant.startContinuous      → Continuous listening (passive)
//   6. voice-coding-assistant.activateNow          → Activate immediately (active)
//   7. voice-coding-assistant.toggleVoiceFeedback  → Toggle TTS on/off
//
// MODULES:
//   voiceRecorder.ts      → Microphone recording via SoX
//   speechToText.ts       → Audio → Text via Whisper
//   commandParser.ts      → Text → Structured command
//   aiEngine.ts           → AI code generation via OpenRouter
//   vscodeController.ts   → Execute actions in VS Code
//   wakeWordDetector.ts   → Detect activation/deactivation phrases   [NEW]
//   voiceFeedback.ts      → Text-to-speech responses                 [NEW]
//   voiceModeManager.ts   → Passive/Active listening state machine   [NEW]
//
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as dotenv from 'dotenv';

// Existing modules
import { recordAudio, cleanupAudioFile } from './voiceRecorder';
import { transcribeAudio, WhisperModelSize } from './speechToText';
import { parseCommand, getCommandDescription, getLanguageExtension, CommandType, ParsedCommand } from './commandParser';
import { generateCode, debugCode, fixError, generateCodeConcept, AIConfig } from './aiEngine';
import * as controller from './vscodeController';

// NEW modules
import { checkWakeWord } from './wakeWordDetector';
import * as voiceFeedback from './voiceFeedback';
import * as modeManager from './voiceModeManager';
import { getFormattedHelp } from './commandDictionary';

// ============================================================================
// Global State
// ============================================================================

/** Status bar item showing recording/listening state */
let statusBarItem: vscode.StatusBarItem;

/** Whether we are currently in a single-shot recording */
let isRecording = false;

/** Maximum retry attempts for speech recognition fallback */
const MAX_RETRY_ATTEMPTS = 2;

// ============================================================================
// Helper: Load .env
// ============================================================================

function loadEnvFile(extensionPath: string): void {
    const envPath = path.join(extensionPath, '.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log('[VoiceCoding] .env loaded from:', envPath);
    } else {
        console.warn('[VoiceCoding] No .env file found at:', envPath);
    }
}

function getApiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
}

// ============================================================================
// Helper: Get AI Config
// ============================================================================

function getAIConfig(): AIConfig | null {
    const apiKey = getApiKey();
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        vscode.window.showErrorMessage(
            '❌ OpenRouter API key not configured!\n\n' +
            'Edit the .env file in the extension folder and set OPENROUTER_API_KEY.\n' +
            'Get your key: https://openrouter.ai/keys'
        );
        return null;
    }

    const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
    return {
        apiKey,
        model: config.get<string>('openRouterModel', 'deepseek/deepseek-chat'),
    };
}

// ============================================================================
// Status Bar (Updated for All Modes)
// ============================================================================

type StatusBarState = 'idle' | 'passive' | 'active' | 'recording' | 'processing' | 'error';

function createStatusBar(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    item.command = 'voice-coding-assistant.startListening';
    updateStatusBar(item, 'idle');
    item.show();
    return item;
}

function updateStatusBar(item: vscode.StatusBarItem, state: StatusBarState): void {
    switch (state) {
        case 'idle':
            item.text = '$(mic) Voice Coding';
            item.tooltip = 'Click to record a voice command. Or start continuous listening.';
            item.backgroundColor = undefined;
            break;
        case 'passive':
            item.text = '$(eye) Passive — Say "Hey Coder"';
            item.tooltip = 'Listening for wake word... Say "Hey Coder" to activate.';
            item.backgroundColor = undefined;
            break;
        case 'active':
            item.text = '$(pulse) ACTIVE — Listening';
            item.tooltip = 'Voice coding ACTIVE. Speak your commands. Say "Stop" to deactivate.';
            item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            break;
        case 'recording':
            item.text = '$(pulse) Recording...';
            item.tooltip = 'Recording your voice command...';
            item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            break;
        case 'processing':
            item.text = '$(sync~spin) Processing...';
            item.tooltip = 'Processing your voice command...';
            item.backgroundColor = undefined;
            break;
        case 'error':
            item.text = '$(error) Voice Error';
            item.tooltip = 'Click to try again';
            item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
    }
}

// ============================================================================
// Core: Execute a Parsed Command (Updated with new commands + voice feedback)
// ============================================================================

/**
 * Takes a parsed command and executes the corresponding VS Code action.
 * Now includes voice feedback for every action.
 */
async function executeCommand(command: ParsedCommand, aiConfig: AIConfig): Promise<void> {
    console.log('[VoiceCoding] Executing command:', command.type, command.params);

    switch (command.type) {

        // ================================================================
        // FILE OPERATIONS
        // ================================================================

        case CommandType.FILE_CREATE: {
            const fileName = command.params.fileName || 'main';
            const ext = command.params.language
                ? getLanguageExtension(command.params.language)
                : '.py';
            await controller.createFile(fileName, ext);
            voiceFeedback.speakAsync(`File ${fileName}${ext} created.`);
            break;
        }

        case CommandType.FILE_OPEN: {
            if (command.params.fileName) {
                await controller.openFile(command.params.fileName);
                voiceFeedback.speakAsync(`Opened ${command.params.fileName}.`);
            } else {
                vscode.window.showWarningMessage('⚠️ Please specify a file name.');
                voiceFeedback.speakAsync('Please specify a file name to open.');
            }
            break;
        }

        case CommandType.FILE_SAVE: {
            await controller.saveFile();
            voiceFeedback.speakAsync('File saved.');
            break;
        }

        case CommandType.FILE_CLOSE: {
            await controller.closeFile();
            voiceFeedback.speakAsync('File closed.');
            break;
        }

        case CommandType.FILE_RUN: {
            await controller.runFile();
            voiceFeedback.speakAsync('Running file.');
            break;
        }

        // ================================================================
        // FILE DELETE (with safety confirmation)
        // ================================================================

        case CommandType.FILE_DELETE: {
            const fileToDelete = command.params.fileName;
            if (!fileToDelete) {
                voiceFeedback.speakAsync('Please specify a file name to delete.');
                break;
            }

            // Safety confirmation
            if (modeManager.getMode() === modeManager.VoiceMode.ACTIVE) {
                // In continuous mode, use voice-based confirmation
                const confirmed = await modeManager.requestConfirmation(
                    `Are you sure you want to delete ${fileToDelete}? Say yes to confirm.`
                );

                if (confirmed) {
                    await controller.deleteFile(fileToDelete, true);
                    voiceFeedback.speakAsync(`${fileToDelete} deleted.`);
                } else {
                    voiceFeedback.speakAsync('Delete cancelled.');
                }
            } else {
                // In single-shot mode, use VS Code dialog
                const confirm = await vscode.window.showWarningMessage(
                    `⚠️ Are you sure you want to delete "${fileToDelete}"?`,
                    { modal: true },
                    'Yes, Delete'
                );
                if (confirm === 'Yes, Delete') {
                    await controller.deleteFile(fileToDelete, true);
                    voiceFeedback.speakAsync(`${fileToDelete} deleted.`);
                } else {
                    voiceFeedback.speakAsync('Delete cancelled.');
                }
            }
            break;
        }

        // ================================================================
        // NAVIGATION
        // ================================================================

        case CommandType.NAVIGATE: {
            const line = command.params.lineNumber ?? 1;
            await controller.navigateToLine(line);
            if (command.params.navTarget === 'top') {
                voiceFeedback.speakAsync('Moved to top of file.');
            } else if (command.params.navTarget === 'bottom') {
                voiceFeedback.speakAsync('Moved to bottom of file.');
            } else {
                voiceFeedback.speakAsync(`Moved to line ${line}.`);
            }
            break;
        }

        case CommandType.NAVIGATE_FUNCTION: {
            const direction = command.params.direction || 'next';
            await controller.navigateToFunction(direction);
            voiceFeedback.speakAsync(`Moved to ${direction} function.`);
            break;
        }

        case CommandType.FIND_SYMBOL: {
            if (command.params.searchTerm) {
                await controller.findSymbol(command.params.searchTerm);
                voiceFeedback.speakAsync(`Found ${command.params.searchTerm}.`);
            } else {
                voiceFeedback.speakAsync('Please specify what to find.');
            }
            break;
        }

        // ================================================================
        // CODE INSERTION (uses AI)
        // ================================================================

        case CommandType.INSERT_CODE: {
            const concept = command.params.codeConcept || 'code';
            const description = command.params.codeDescription || command.originalText;
            const existingCode = controller.getAllText() || undefined;

            voiceFeedback.speakAsync(`Generating ${concept}.`);

            const result = await generateCodeConcept(
                concept,
                description,
                aiConfig,
                existingCode
            );

            await controller.insertCode(result.code);
            vscode.window.showInformationMessage(
                `✅ Inserted ${concept}! (Model: ${result.model})`
            );
            voiceFeedback.speakAsync(`${concept} inserted.`);
            break;
        }

        // ================================================================
        // DEBUGGING (uses AI)
        // ================================================================

        case CommandType.DEBUG: {
            const code = controller.getAllText();
            if (!code) {
                voiceFeedback.speakAsync('No file is open to debug.');
                break;
            }

            voiceFeedback.speakAsync('Analyzing code.');

            const result = await debugCode(code, aiConfig, command.params.lineNumber);
            controller.showOutput('Debug Analysis', result.code);
            vscode.window.showInformationMessage('🐛 Debug analysis ready — check Output panel.');
            voiceFeedback.speakAsync('Debug analysis ready. Check the output panel.');
            break;
        }

        // ================================================================
        // FIX ERROR (uses AI)
        // ================================================================

        case CommandType.FIX_ERROR: {
            const codeToFix = controller.getAllText();
            if (!codeToFix) {
                voiceFeedback.speakAsync('No file is open to fix.');
                break;
            }

            voiceFeedback.speakAsync('Fixing error.');

            const fixResult = await fixError(codeToFix, aiConfig);

            if (modeManager.getMode() === modeManager.VoiceMode.ACTIVE) {
                // In continuous mode, auto-apply (user already said "fix")
                await controller.replaceAllCode(fixResult.code);
                voiceFeedback.speakAsync('Error fixed.');
                vscode.window.showInformationMessage('✅ Error fixed!');
            } else {
                const confirm = await vscode.window.showInformationMessage(
                    '🔧 AI generated a fix. Apply it?',
                    'Yes, Apply Fix',
                    'Show in Output',
                    'Cancel'
                );

                if (confirm === 'Yes, Apply Fix') {
                    await controller.replaceAllCode(fixResult.code);
                    voiceFeedback.speakAsync('Error fixed.');
                } else if (confirm === 'Show in Output') {
                    controller.showOutput('Fixed Code', fixResult.code);
                }
            }
            break;
        }

        // ================================================================
        // RENAME
        // ================================================================

        case CommandType.EDIT_RENAME: {
            if (command.params.oldName && command.params.newName) {
                await controller.renameSymbol(command.params.oldName, command.params.newName);
                voiceFeedback.speakAsync(
                    `Renamed ${command.params.oldName} to ${command.params.newName}.`
                );
            } else {
                voiceFeedback.speakAsync('Rename requires old and new names.');
            }
            break;
        }

        // ================================================================
        // FOLDER & PROJECT
        // ================================================================

        case CommandType.FOLDER_CREATE: {
            let folderName = command.params.folderName;
            if (!folderName) {
                folderName = await vscode.window.showInputBox({
                    prompt: 'Enter folder name:',
                    placeHolder: 'my-folder',
                }) || undefined;
            }
            if (folderName) {
                await controller.createFolder(folderName);
                voiceFeedback.speakAsync(`Folder ${folderName} created.`);
            }
            break;
        }

        case CommandType.PROJECT_CREATE: {
            voiceFeedback.speakAsync('Select a location for the new project.');
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select project location',
            });

            if (folderUri && folderUri.length > 0) {
                await vscode.commands.executeCommand('vscode.openFolder', folderUri[0]);
            }
            break;
        }

        // ================================================================
        // IMPORT MODULE
        // ================================================================

        case CommandType.IMPORT_MODULE: {
            if (command.params.moduleName) {
                await controller.importModule(command.params.moduleName);
                voiceFeedback.speakAsync(`${command.params.moduleName} imported.`);
            } else {
                voiceFeedback.speakAsync('Please specify a module name.');
            }
            break;
        }

        // ================================================================
        // PROGRAM CONTROL (NEW)
        // ================================================================

        case CommandType.STOP_PROGRAM: {
            await controller.stopProgram();
            voiceFeedback.speakAsync('Program stopped.');
            break;
        }

        case CommandType.OPEN_TERMINAL: {
            await controller.openTerminal();
            voiceFeedback.speakAsync('Terminal opened.');
            break;
        }

        // ================================================================
        // ADDITIONAL EDITOR COMMANDS
        // ================================================================

        case CommandType.SAVE_ALL: {
            await vscode.workspace.saveAll();
            vscode.window.showInformationMessage('💾 All files saved.');
            voiceFeedback.speakAsync('All files saved.');
            break;
        }

        case CommandType.REOPEN_FILE: {
            await vscode.commands.executeCommand('workbench.action.reopenClosedEditor');
            voiceFeedback.speakAsync('Reopened last closed file.');
            break;
        }

        case CommandType.SWITCH_FILE: {
            await vscode.commands.executeCommand('workbench.action.nextEditor');
            voiceFeedback.speakAsync('Switched to next file.');
            break;
        }

        case CommandType.UNDO: {
            await vscode.commands.executeCommand('undo');
            voiceFeedback.speakAsync('Undone.');
            break;
        }

        case CommandType.REDO: {
            await vscode.commands.executeCommand('redo');
            voiceFeedback.speakAsync('Redone.');
            break;
        }

        case CommandType.SELECT_ALL: {
            await vscode.commands.executeCommand('editor.action.selectAll');
            voiceFeedback.speakAsync('All text selected.');
            break;
        }

        case CommandType.COPY: {
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            voiceFeedback.speakAsync('Copied.');
            break;
        }

        case CommandType.PASTE: {
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            voiceFeedback.speakAsync('Pasted.');
            break;
        }

        case CommandType.SHOW_HELP: {
            const helpText = getFormattedHelp();
            controller.showOutput('Voice Commands Help', helpText);
            vscode.window.showInformationMessage('❓ Voice commands help — check Output panel.');
            voiceFeedback.speakAsync('Voice commands help is shown in the output panel.');
            break;
        }

        // ================================================================
        // LINE EDITING
        // ================================================================

        case CommandType.DELETE_LINE: {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                voiceFeedback.speakAsync('No file is open.');
                break;
            }

            const startLine = command.params.lineNumber;
            const endLine = command.params.endLineNumber;

            if (startLine && endLine) {
                // Delete range: "delete lines 5 to 10"
                const rangeStart = new vscode.Position(startLine - 1, 0);
                const rangeEnd = new vscode.Position(endLine, 0);
                await editor.edit(editBuilder => {
                    editBuilder.delete(new vscode.Range(rangeStart, rangeEnd));
                });
                voiceFeedback.speakAsync(`Deleted lines ${startLine} to ${endLine}.`);
            } else if (startLine) {
                // Delete specific line: "delete line 5"
                const lineIdx = startLine - 1;
                const line = editor.document.lineAt(lineIdx);
                const rangeStart = new vscode.Position(lineIdx, 0);
                const rangeEnd = new vscode.Position(lineIdx + 1, 0);
                await editor.edit(editBuilder => {
                    editBuilder.delete(new vscode.Range(rangeStart, rangeEnd));
                });
                voiceFeedback.speakAsync(`Deleted line ${startLine}.`);
            } else {
                // Delete current line: "delete line"
                await vscode.commands.executeCommand('editor.action.deleteLines');
                voiceFeedback.speakAsync('Line deleted.');
            }
            break;
        }

        case CommandType.CUT_LINE: {
            await vscode.commands.executeCommand('editor.action.cutLines');
            voiceFeedback.speakAsync('Line cut.');
            break;
        }

        case CommandType.DUPLICATE_LINE: {
            await vscode.commands.executeCommand('editor.action.copyLinesDownAction');
            voiceFeedback.speakAsync('Line duplicated.');
            break;
        }

        // ================================================================
        // AI GENERATE (fallback)
        // ================================================================

        case CommandType.AI_GENERATE: {
            voiceFeedback.speakAsync('Generating code.');
            const result = await generateCode(command.originalText, aiConfig);
            await controller.insertCode(result.code);
            vscode.window.showInformationMessage(
                `✅ Code generated! (Model: ${result.model})`
            );
            voiceFeedback.speakAsync('Code generated and inserted.');
            break;
        }

        default: {
            voiceFeedback.speakAsync('Sending to AI.');
            const fallback = await generateCode(command.originalText, aiConfig);
            await controller.insertCode(fallback.code);
            voiceFeedback.speakAsync('Code generated.');
            break;
        }
    }
}

// ============================================================================
// Command Handler for Continuous Listening Mode
// ============================================================================

/**
 * This function is called by the VoiceModeManager when a command is
 * transcribed in ACTIVE mode. It parses and executes the command.
 *
 * @param transcribedText - The transcribed voice text
 */
async function handleContinuousCommand(transcribedText: string): Promise<void> {
    const aiConfig = getAIConfig();
    if (!aiConfig) { return; }

    console.log('[VoiceCoding] Continuous command:', transcribedText);

    const command = parseCommand(transcribedText);
    const description = getCommandDescription(command);

    // Show what was heard in the status bar area
    vscode.window.showInformationMessage(`🗣️ "${transcribedText}" → ${description}`);

    try {
        await executeCommand(command, aiConfig);
    } catch (error: any) {
        console.error('[VoiceCoding] Command error:', error);
        vscode.window.showErrorMessage(`❌ Error: ${error.message}`);
        voiceFeedback.speakAsync('An error occurred. Please try again.');
    }
}

// ============================================================================
// Single-Shot Voice Pipeline (preserved from original)
// ============================================================================

/**
 * Single-shot voice recording: records once, transcribes, confirms, executes.
 * This is the original flow preserved for users who don't want continuous listening.
 */
async function startVoiceCodingPipeline(context: vscode.ExtensionContext): Promise<void> {
    if (isRecording) {
        vscode.window.showWarningMessage('🎤 Already recording!');
        return;
    }

    const aiConfig = getAIConfig();
    if (!aiConfig) { return; }

    const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
    const recordingDuration = config.get<number>('recordingDurationMs', 7000);
    const whisperModel = config.get<string>('whisperModel', 'base') as WhisperModelSize;

    let attempts = 0;

    while (attempts <= MAX_RETRY_ATTEMPTS) {
        const audioFilePath = path.join(os.tmpdir(), `voice-coding-${Date.now()}.wav`);

        try {
            isRecording = true;
            updateStatusBar(statusBarItem, 'recording');

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: '🎤 Voice Coding Assistant',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: `Recording... Speak now! (${recordingDuration / 1000}s)`
                    });

                    const recording = await recordAudio({
                        durationMs: recordingDuration,
                        outputPath: audioFilePath,
                    });

                    updateStatusBar(statusBarItem, 'processing');
                    progress.report({ message: 'Transcribing with Whisper...' });

                    const transcription = await transcribeAudio(audioFilePath, whisperModel);

                    if (!transcription.text || transcription.text.trim().length === 0) {
                        attempts++;
                        voiceFeedback.speakAsync('Could not detect speech. Please try again.');
                        if (attempts <= MAX_RETRY_ATTEMPTS) {
                            const retry = await vscode.window.showWarningMessage(
                                `⚠️ No speech detected. (Attempt ${attempts}/${MAX_RETRY_ATTEMPTS + 1})`,
                                'Retry', 'Type Command', 'Cancel'
                            );
                            if (retry === 'Retry') { return; }
                            if (retry === 'Type Command') {
                                await manualCommandInput(aiConfig);
                                return;
                            }
                        } else {
                            const fallback = await vscode.window.showWarningMessage(
                                `⚠️ Speech failed after ${MAX_RETRY_ATTEMPTS + 1} attempts.`,
                                'Type Command', 'Cancel'
                            );
                            if (fallback === 'Type Command') {
                                await manualCommandInput(aiConfig);
                            }
                        }
                        return;
                    }

                    // Parse and display
                    const parsedCommand = parseCommand(transcription.text);
                    const description = getCommandDescription(parsedCommand);

                    const userChoice = await vscode.window.showInformationMessage(
                        `🗣️ Heard: "${transcription.text}"\n\nAction: ${description}`,
                        'Execute', 'Retry', 'Type Instead', 'Cancel'
                    );

                    if (userChoice === 'Execute') {
                        progress.report({ message: 'Executing command...' });
                        await executeCommand(parsedCommand, aiConfig);
                        updateStatusBar(statusBarItem, 'idle');
                    } else if (userChoice === 'Retry') {
                        attempts++;
                    } else if (userChoice === 'Type Instead') {
                        await manualCommandInput(aiConfig);
                        updateStatusBar(statusBarItem, 'idle');
                    } else {
                        vscode.window.showInformationMessage('Cancelled.');
                        updateStatusBar(statusBarItem, 'idle');
                    }
                }
            );

            if (attempts > MAX_RETRY_ATTEMPTS) { break; }

        } catch (error: any) {
            console.error('[VoiceCoding] Error:', error);
            updateStatusBar(statusBarItem, 'error');
            voiceFeedback.speakAsync('An error occurred.');

            const action = await vscode.window.showErrorMessage(
                `❌ Error: ${error.message}`,
                'Retry', 'Type Command', 'Cancel'
            );
            if (action === 'Retry') { attempts++; continue; }
            if (action === 'Type Command') { await manualCommandInput(aiConfig); }
            break;

        } finally {
            isRecording = false;
            cleanupAudioFile(audioFilePath);
        }
    }

    updateStatusBar(statusBarItem, 'idle');
}

// ============================================================================
// Manual Text Input Fallback
// ============================================================================

async function manualCommandInput(aiConfig: AIConfig): Promise<void> {
    const input = await vscode.window.showInputBox({
        prompt: '⌨️ Type your coding command',
        placeHolder: 'create a python file',
        ignoreFocusOut: true,
    });

    if (!input || input.trim().length === 0) { return; }

    const command = parseCommand(input);
    const description = getCommandDescription(command);
    vscode.window.showInformationMessage(`⌨️ ${description}`);

    try {
        await executeCommand(command, aiConfig);
    } catch (error: any) {
        vscode.window.showErrorMessage(`❌ Error: ${error.message}`);
    }
}

// ============================================================================
// Extension Activation
// ============================================================================

export function activate(context: vscode.ExtensionContext) {
    console.log('[VoiceCoding] ✅ Extension activated!');

    // Load environment variables
    loadEnvFile(context.extensionPath);

    // Load voice feedback settings
    voiceFeedback.loadSettings();

    // Create status bar
    statusBarItem = createStatusBar();
    context.subscriptions.push(statusBarItem);

    // ── Set up Voice Mode Manager callbacks ────────────────────────
    modeManager.onCommand(handleContinuousCommand);
    modeManager.onModeChange((mode) => {
        switch (mode) {
            case modeManager.VoiceMode.PASSIVE:
                updateStatusBar(statusBarItem, 'passive');
                break;
            case modeManager.VoiceMode.ACTIVE:
                updateStatusBar(statusBarItem, 'active');
                break;
            case modeManager.VoiceMode.OFF:
                updateStatusBar(statusBarItem, 'idle');
                break;
        }
    });

    // ========================================================================
    // COMMAND 1: Hello World (test)
    // ========================================================================
    const helloCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.helloWorld',
        () => {
            vscode.window.showInformationMessage(
                '🎤 Voice Coding Assistant is active!\n\n' +
                'Commands:\n' +
                '• "Start Listening" — Single voice command\n' +
                '• "Start Continuous" — Continuous hands-free mode\n' +
                '• "Type Command" — Manual text input'
            );
            voiceFeedback.speakAsync('Voice coding assistant is ready.');
        }
    );

    // ========================================================================
    // COMMAND 2: Start Listening (single-shot)
    // ========================================================================
    const startCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.startListening',
        () => startVoiceCodingPipeline(context)
    );

    // ========================================================================
    // COMMAND 3: Stop Listening
    // ========================================================================
    const stopCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.stopListening',
        () => {
            if (modeManager.isListening()) {
                modeManager.stopAll();
                voiceFeedback.speakAsync('Voice assistant stopped.');
                updateStatusBar(statusBarItem, 'idle');
            } else if (isRecording) {
                isRecording = false;
                updateStatusBar(statusBarItem, 'idle');
                vscode.window.showInformationMessage('🛑 Recording stopped.');
            } else {
                vscode.window.showInformationMessage('ℹ️ Not currently listening.');
            }
        }
    );

    // ========================================================================
    // COMMAND 4: Type Command (manual)
    // ========================================================================
    const typeCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.typeCommand',
        async () => {
            const aiConfig = getAIConfig();
            if (!aiConfig) { return; }
            await manualCommandInput(aiConfig);
        }
    );

    // ========================================================================
    // COMMAND 5: Start Continuous Listening (passive → active) [NEW]
    // ========================================================================
    const continuousCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.startContinuous',
        async () => {
            if (modeManager.isListening()) {
                vscode.window.showInformationMessage(
                    `ℹ️ Already listening in ${modeManager.getMode()} mode.`
                );
                return;
            }
            await modeManager.startPassiveListening();
        }
    );

    // ========================================================================
    // COMMAND 6: Activate Now (skip wake word) [NEW]
    // ========================================================================
    const activateCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.activateNow',
        async () => {
            await modeManager.activateNow();
        }
    );

    // ========================================================================
    // COMMAND 7: Toggle Voice Feedback [NEW]
    // ========================================================================
    const toggleFeedbackCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.toggleVoiceFeedback',
        () => {
            const current = voiceFeedback.isEnabled();
            voiceFeedback.setEnabled(!current);
            const state = !current ? 'ON' : 'OFF';
            vscode.window.showInformationMessage(`🔊 Voice feedback: ${state}`);
            if (!current) {
                voiceFeedback.speakAsync('Voice feedback enabled.');
            }
        }
    );

    // Register all commands
    context.subscriptions.push(
        helloCmd, startCmd, stopCmd, typeCmd,
        continuousCmd, activateCmd, toggleFeedbackCmd
    );

    console.log('[VoiceCoding] All commands registered:');
    console.log('  - helloWorld');
    console.log('  - startListening (single-shot)');
    console.log('  - stopListening');
    console.log('  - typeCommand');
    console.log('  - startContinuous (passive → active)');
    console.log('  - activateNow (immediate active)');
    console.log('  - toggleVoiceFeedback');
}

// ============================================================================
// Extension Deactivation
// ============================================================================

export function deactivate() {
    console.log('[VoiceCoding] Extension deactivated.');
    modeManager.stopAll();
    voiceFeedback.stopSpeaking();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
