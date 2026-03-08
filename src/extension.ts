// ============================================================================
// Voice Coding Assistant — Main Extension Entry Point
// ============================================================================
//
// This is the heart of the extension. VS Code calls activate() when the
// extension starts and deactivate() when it shuts down.
//
// ARCHITECTURE OVERVIEW:
//   ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
//   │  Microphone  │────▶│  SoX Record  │────▶│  WAV File     │
//   └─────────────┘     └──────────────┘     └───────┬───────┘
//                                                     │
//                                                     ▼
//   ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
//   │  VS Code     │◀───│  Command     │◀───│  Whisper STT  │
//   │  Action      │    │  Parser      │    │  (Python)     │
//   └──────┬──────┘     └──────────────┘     └───────────────┘
//          │                    │
//          │           ┌───────▼───────┐
//          │           │  OpenRouter   │  (for code generation,
//          └───────────│  AI Engine    │   debugging, fixes)
//                      └───────────────┘
//
// COMMANDS REGISTERED:
//   1. voice-coding-assistant.helloWorld     → Test that extension works
//   2. voice-coding-assistant.startListening → Record & process voice command
//   3. voice-coding-assistant.stopListening  → Stop recording (safety)
//   4. voice-coding-assistant.typeCommand    → Type a command manually (fallback)
//
// MODULES:
//   voiceRecorder.ts     → Microphone recording via SoX
//   speechToText.ts      → Audio → Text via Whisper
//   commandParser.ts     → Text → Structured command
//   aiEngine.ts          → AI code generation via OpenRouter
//   vscodeController.ts  → Execute actions in VS Code
//
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as dotenv from 'dotenv';

// Import our modules
import { recordAudio, cleanupAudioFile, RecordingConfig } from './voiceRecorder';
import { transcribeAudio, WhisperModelSize } from './speechToText';
import { parseCommand, getCommandDescription, getLanguageExtension, CommandType, ParsedCommand } from './commandParser';
import { generateCode, debugCode, fixError, generateCodeConcept, AIConfig } from './aiEngine';
import * as controller from './vscodeController';

// ============================================================================
// Global State
// ============================================================================

/** Status bar item showing recording state */
let statusBarItem: vscode.StatusBarItem;

/** Whether we are currently recording */
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
// Helper: Get AI Config from VS Code Settings
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
        model: config.get<string>('openRouterModel', 'openai/gpt-3.5-turbo'),
    };
}

// ============================================================================
// Status Bar
// ============================================================================

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

function updateStatusBar(item: vscode.StatusBarItem, state: 'idle' | 'recording' | 'processing' | 'error'): void {
    switch (state) {
        case 'idle':
            item.text = '$(mic) Voice Coding';
            item.tooltip = 'Click to start voice coding (or use command palette)';
            item.backgroundColor = undefined;
            break;
        case 'recording':
            item.text = '$(pulse) Recording...';
            item.tooltip = 'Listening for your voice command...';
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
// Core: Execute a Parsed Command
// ============================================================================

/**
 * Takes a parsed command and executes the corresponding VS Code action.
 * This is the central dispatch function.
 *
 * @param command - The parsed command from the command parser
 * @param aiConfig - AI configuration for commands that need AI
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
            break;
        }

        case CommandType.FILE_OPEN: {
            if (command.params.fileName) {
                await controller.openFile(command.params.fileName);
            } else {
                vscode.window.showWarningMessage('⚠️ Please specify a file name to open.');
            }
            break;
        }

        case CommandType.FILE_SAVE: {
            await controller.saveFile();
            break;
        }

        case CommandType.FILE_CLOSE: {
            await controller.closeFile();
            break;
        }

        case CommandType.FILE_RUN: {
            await controller.runFile();
            break;
        }

        // ================================================================
        // NAVIGATION
        // ================================================================

        case CommandType.NAVIGATE: {
            const line = command.params.lineNumber ?? 1;
            await controller.navigateToLine(line);
            break;
        }

        // ================================================================
        // CODE INSERTION (uses AI)
        // ================================================================

        case CommandType.INSERT_CODE: {
            const concept = command.params.codeConcept || 'code';
            const description = command.params.codeDescription || command.originalText;
            const existingCode = controller.getAllText() || undefined;

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
            break;
        }

        // ================================================================
        // DEBUGGING (uses AI)
        // ================================================================

        case CommandType.DEBUG: {
            const code = controller.getAllText();
            if (!code) {
                vscode.window.showWarningMessage('⚠️ No file is open to debug.');
                break;
            }

            const result = await debugCode(code, aiConfig, command.params.lineNumber);
            controller.showOutput('Debug Analysis', result.code);
            vscode.window.showInformationMessage('🐛 Debug analysis ready — check Output panel.');
            break;
        }

        // ================================================================
        // FIX ERROR (uses AI)
        // ================================================================

        case CommandType.FIX_ERROR: {
            const codeToFix = controller.getAllText();
            if (!codeToFix) {
                vscode.window.showWarningMessage('⚠️ No file is open to fix.');
                break;
            }

            const fixResult = await fixError(codeToFix, aiConfig);

            // Ask user before replacing
            const confirm = await vscode.window.showInformationMessage(
                '🔧 AI has generated a fix. Replace your code with the fixed version?',
                'Yes, Apply Fix',
                'Show in Output',
                'Cancel'
            );

            if (confirm === 'Yes, Apply Fix') {
                await controller.replaceAllCode(fixResult.code);
                vscode.window.showInformationMessage('✅ Error fixed!');
            } else if (confirm === 'Show in Output') {
                controller.showOutput('Fixed Code', fixResult.code);
            }
            break;
        }

        // ================================================================
        // RENAME
        // ================================================================

        case CommandType.EDIT_RENAME: {
            if (command.params.oldName && command.params.newName) {
                await controller.renameSymbol(command.params.oldName, command.params.newName);
            } else {
                vscode.window.showWarningMessage('⚠️ Rename requires old and new names.');
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
            }
            break;
        }

        case CommandType.PROJECT_CREATE: {
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
            } else {
                vscode.window.showWarningMessage('⚠️ Please specify a module name.');
            }
            break;
        }

        // ================================================================
        // AI GENERATE (fallback for unrecognized commands)
        // ================================================================

        case CommandType.AI_GENERATE: {
            const result = await generateCode(command.originalText, aiConfig);
            await controller.insertCode(result.code);
            vscode.window.showInformationMessage(
                `✅ Code generated! (Model: ${result.model})`
            );
            break;
        }

        default: {
            vscode.window.showWarningMessage(
                `❓ Unknown command type: ${command.type}. Sending to AI...`
            );
            const fallback = await generateCode(command.originalText, aiConfig);
            await controller.insertCode(fallback.code);
            break;
        }
    }
}

// ============================================================================
// Core: Voice Recording → Transcription → Command → Action Pipeline
// ============================================================================

/**
 * The main voice coding pipeline with safety fallback.
 *
 * FLOW:
 *   1. Record audio from microphone via SoX
 *   2. Transcribe audio to text via Whisper
 *   3. If transcription fails or is empty → ask user to repeat (up to MAX_RETRY_ATTEMPTS)
 *   4. Show user what was heard, ask for confirmation
 *   5. Parse the transcribed text into a structured command
 *   6. Execute the command
 *
 * SAFETY FALLBACK:
 *   If speech recognition fails, the system will:
 *   - Notify the user with a clear error message
 *   - Offer to retry recording
 *   - After MAX_RETRY_ATTEMPTS, suggest using the manual text input
 *
 * @param context - VS Code extension context
 */
async function startVoiceCodingPipeline(context: vscode.ExtensionContext): Promise<void> {
    if (isRecording) {
        vscode.window.showWarningMessage('🎤 Already recording! Please wait...');
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

            // ============================================================
            // STEP 1: Record audio
            // ============================================================
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

                    console.log('[VoiceCoding] Recording complete:', recording.sizeBytes, 'bytes');

                    // ============================================================
                    // STEP 2: Transcribe with Whisper
                    // ============================================================
                    updateStatusBar(statusBarItem, 'processing');
                    progress.report({ message: 'Transcribing with Whisper...' });

                    const transcription = await transcribeAudio(audioFilePath, whisperModel);

                    // ============================================================
                    // SAFETY FALLBACK: Empty transcription
                    // ============================================================
                    if (!transcription.text || transcription.text.trim().length === 0) {
                        attempts++;
                        if (attempts <= MAX_RETRY_ATTEMPTS) {
                            const retry = await vscode.window.showWarningMessage(
                                `⚠️ Could not detect speech. (Attempt ${attempts}/${MAX_RETRY_ATTEMPTS + 1})\n\n` +
                                `Please speak more clearly and try again.`,
                                'Retry',
                                'Type Command Instead',
                                'Cancel'
                            );

                            if (retry === 'Retry') {
                                return; // Continue the while loop
                            } else if (retry === 'Type Command Instead') {
                                await manualCommandInput(aiConfig);
                                return;
                            }
                        } else {
                            const fallback = await vscode.window.showWarningMessage(
                                `⚠️ Speech recognition failed after ${MAX_RETRY_ATTEMPTS + 1} attempts.\n\n` +
                                `Would you like to type your command instead?`,
                                'Type Command',
                                'Cancel'
                            );
                            if (fallback === 'Type Command') {
                                await manualCommandInput(aiConfig);
                            }
                        }
                        return;
                    }

                    // ============================================================
                    // STEP 3: Confirm transcription with user
                    // ============================================================
                    const parsedCommand = parseCommand(transcription.text);
                    const description = getCommandDescription(parsedCommand);

                    const userChoice = await vscode.window.showInformationMessage(
                        `🗣️ Heard: "${transcription.text}"\n\n` +
                        `Action: ${description}`,
                        'Execute',
                        'Retry Recording',
                        'Type Instead',
                        'Cancel'
                    );

                    if (userChoice === 'Execute') {
                        // ============================================================
                        // STEP 4: Execute the command
                        // ============================================================
                        progress.report({ message: 'Executing command...' });
                        await executeCommand(parsedCommand, aiConfig);
                        updateStatusBar(statusBarItem, 'idle');
                        return;

                    } else if (userChoice === 'Retry Recording') {
                        attempts++;
                        return; // Continue the while loop

                    } else if (userChoice === 'Type Instead') {
                        await manualCommandInput(aiConfig);
                        updateStatusBar(statusBarItem, 'idle');
                        return;

                    } else {
                        // Cancelled
                        vscode.window.showInformationMessage('Voice coding cancelled.');
                        updateStatusBar(statusBarItem, 'idle');
                        return;
                    }
                }
            );

            // If we get here, the withProgress callback completed
            // Check if we need to retry (attempts was incremented inside)
            if (attempts > MAX_RETRY_ATTEMPTS) {
                break;
            }

        } catch (error: any) {
            console.error('[VoiceCoding] Pipeline error:', error);
            updateStatusBar(statusBarItem, 'error');

            const action = await vscode.window.showErrorMessage(
                `❌ Voice Coding Error:\n\n${error.message}`,
                'Retry',
                'Type Command Instead',
                'Cancel'
            );

            if (action === 'Retry') {
                attempts++;
                continue;
            } else if (action === 'Type Command Instead') {
                await manualCommandInput(aiConfig);
                break;
            } else {
                break;
            }

        } finally {
            isRecording = false;
            cleanupAudioFile(audioFilePath);
        }
    }

    updateStatusBar(statusBarItem, 'idle');
}

// ============================================================================
// Fallback: Manual Text Input
// ============================================================================

/**
 * Allows the user to type a command manually instead of using voice.
 * This is the safety fallback when speech recognition fails.
 *
 * @param aiConfig - AI configuration for commands that need AI
 */
async function manualCommandInput(aiConfig: AIConfig): Promise<void> {
    const input = await vscode.window.showInputBox({
        prompt: '⌨️ Type your coding command (e.g., "create a python file", "go to line 10")',
        placeHolder: 'create a python file',
        ignoreFocusOut: true,
    });

    if (!input || input.trim().length === 0) {
        return;
    }

    const command = parseCommand(input);
    const description = getCommandDescription(command);

    vscode.window.showInformationMessage(`⌨️ Command: ${description}`);

    try {
        await executeCommand(command, aiConfig);
    } catch (error: any) {
        vscode.window.showErrorMessage(`❌ Error: ${error.message}`);
    }
}

// ============================================================================
// Extension Activation
// ============================================================================

/**
 * Called by VS Code when the extension is activated.
 * Registers all commands and sets up the status bar.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('[VoiceCoding] ✅ Extension activated!');

    // Load environment variables
    loadEnvFile(context.extensionPath);

    // Create status bar item
    statusBarItem = createStatusBar();
    context.subscriptions.push(statusBarItem);

    // ========================================================================
    // COMMAND 1: Hello World (test)
    // ========================================================================
    const helloCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.helloWorld',
        () => {
            vscode.window.showInformationMessage(
                '🎤 Voice Coding Assistant is active!\n\n' +
                'Use "Voice Coding: Start Listening" to begin, or click the mic in the status bar.'
            );
        }
    );

    // ========================================================================
    // COMMAND 2: Start Listening (main command)
    // ========================================================================
    const startCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.startListening',
        () => startVoiceCodingPipeline(context)
    );

    // ========================================================================
    // COMMAND 3: Stop Listening (safety)
    // ========================================================================
    const stopCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.stopListening',
        () => {
            if (isRecording) {
                isRecording = false;
                updateStatusBar(statusBarItem, 'idle');
                vscode.window.showInformationMessage('🛑 Voice recording stopped.');
            } else {
                vscode.window.showInformationMessage('ℹ️ Not currently recording.');
            }
        }
    );

    // ========================================================================
    // COMMAND 4: Type Command (manual fallback)
    // ========================================================================
    const typeCmd = vscode.commands.registerCommand(
        'voice-coding-assistant.typeCommand',
        async () => {
            const aiConfig = getAIConfig();
            if (!aiConfig) { return; }
            await manualCommandInput(aiConfig);
        }
    );

    // Register all commands
    context.subscriptions.push(helloCmd, startCmd, stopCmd, typeCmd);

    console.log('[VoiceCoding] All commands registered:');
    console.log('  - voice-coding-assistant.helloWorld');
    console.log('  - voice-coding-assistant.startListening');
    console.log('  - voice-coding-assistant.stopListening');
    console.log('  - voice-coding-assistant.typeCommand');
}

// ============================================================================
// Extension Deactivation
// ============================================================================

/**
 * Called by VS Code when the extension is deactivated.
 * Clean up resources.
 */
export function deactivate() {
    console.log('[VoiceCoding] Extension deactivated.');
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
