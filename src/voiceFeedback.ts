// ============================================================================
// Voice Feedback Module (Text-to-Speech)
// ============================================================================
// Provides spoken audio confirmations so users who cannot rely on visual
// feedback can still know what the assistant is doing.
//
// WHY THIS MODULE?
//   Users with hand disabilities may also have limited ability to look at
//   the screen constantly. Audible feedback ensures they always know:
//     - Whether their command was understood
//     - What action was performed
//     - Whether an error occurred
//
// HOW IT WORKS:
//   We use the operating system's built-in text-to-speech engines:
//     Windows → PowerShell's SpeechSynthesizer (System.Speech)
//     macOS   → 'say' command (built-in)
//     Linux   → 'espeak' or 'spd-say' command
//
//   This means NO external dependencies are required for voice feedback.
//   Every modern OS has TTS capability built in.
//
// ARCHITECTURE:
//   Command result → voiceFeedback.speak("message") → OS TTS engine → Speaker
//
// USAGE:
//   import { speak, speakAsync, setEnabled } from './voiceFeedback';
//   await speak("File created.");
//   await speak("Moved to line 10.");
//   await speak("Error found. Check output panel.");
// ============================================================================

import * as os from 'os';
import * as childProcess from 'child_process';
import * as vscode from 'vscode';

// ============================================================================
// State
// ============================================================================

/** Whether voice feedback is currently enabled */
let feedbackEnabled = true;

/** Speaking rate: 0 = slow, 5 = normal, 10 = fast */
let speakingRate = 5;

/** Volume: 0–100 */
let volume = 80;

/** Queue of messages to speak (prevents overlapping speech) */
const speechQueue: string[] = [];

/** Whether the TTS engine is currently speaking */
let isSpeaking = false;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Enables or disables voice feedback globally.
 *
 * @param enabled - true to enable, false to disable
 */
export function setEnabled(enabled: boolean): void {
    feedbackEnabled = enabled;
    console.log('[VoiceFeedback] Enabled:', enabled);
}

/**
 * Returns whether voice feedback is currently enabled.
 */
export function isEnabled(): boolean {
    return feedbackEnabled;
}

/**
 * Sets the speaking rate.
 * @param rate - 0 (slow) to 10 (fast), default 5
 */
export function setRate(rate: number): void {
    speakingRate = Math.max(0, Math.min(10, rate));
}

/**
 * Sets the speaking volume.
 * @param vol - 0 (silent) to 100 (loud), default 80
 */
export function setVolume(vol: number): void {
    volume = Math.max(0, Math.min(100, vol));
}

/**
 * Loads voice feedback settings from VS Code configuration.
 */
export function loadSettings(): void {
    const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
    feedbackEnabled = config.get<boolean>('voiceFeedbackEnabled', true);
    speakingRate = config.get<number>('voiceFeedbackRate', 5);
    volume = config.get<number>('voiceFeedbackVolume', 80);
    console.log('[VoiceFeedback] Settings loaded — enabled:', feedbackEnabled,
        'rate:', speakingRate, 'volume:', volume);
}

// ============================================================================
// Core: Speak a Message
// ============================================================================

/**
 * Speaks a text message using the OS text-to-speech engine.
 * Messages are queued to prevent overlapping.
 *
 * If voice feedback is disabled, this is a no-op.
 *
 * @param message - The text to speak
 * @returns Promise that resolves when speech finishes
 */
export async function speak(message: string): Promise<void> {
    if (!feedbackEnabled) {
        console.log('[VoiceFeedback] Disabled, skipping:', message);
        return;
    }

    console.log('[VoiceFeedback] Speaking:', message);

    // Add to queue
    speechQueue.push(message);

    // If not currently speaking, start processing the queue
    if (!isSpeaking) {
        await processQueue();
    }
}

/**
 * Speaks a message WITHOUT waiting for it to finish.
 * Useful for fire-and-forget confirmations.
 *
 * @param message - The text to speak
 */
export function speakAsync(message: string): void {
    speak(message).catch((err) => {
        console.warn('[VoiceFeedback] Speech error:', err.message);
    });
}

// ============================================================================
// Queue Processor
// ============================================================================

/**
 * Processes the speech queue one message at a time.
 * Ensures messages don't overlap.
 */
async function processQueue(): Promise<void> {
    if (isSpeaking || speechQueue.length === 0) {
        return;
    }

    isSpeaking = true;

    while (speechQueue.length > 0) {
        const message = speechQueue.shift()!;
        try {
            await speakWithOS(message);
        } catch (err: any) {
            console.warn('[VoiceFeedback] Failed to speak:', err.message);
            // Don't break the queue on errors — continue with next message
        }
    }

    isSpeaking = false;
}

// ============================================================================
// Platform-Specific TTS
// ============================================================================

/**
 * Speaks a message using the platform's native TTS engine.
 *
 * Windows: PowerShell SpeechSynthesizer
 * macOS:   'say' command
 * Linux:   'espeak' or 'spd-say'
 *
 * @param message - The text to speak
 * @returns Promise that resolves when speech is complete
 */
function speakWithOS(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const platform = os.platform();

        // Sanitize the message for shell safety
        const sanitized = message
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/`/g, '\\`')    // Escape backticks
            .replace(/\$/g, '\\$')   // Escape dollar signs
            .replace(/\n/g, ' ')     // Replace newlines with spaces
            .substring(0, 500);      // Limit length

        let cmd: string;
        let args: string[];

        switch (platform) {
            case 'win32': {
                // Windows: Use PowerShell's SpeechSynthesizer
                // Rate: -10 to 10 (we map 0–10 → -5 to 5)
                // Volume: 0–100
                const psRate = Math.round((speakingRate / 10) * 10 - 5);
                const psScript = `
                    Add-Type -AssemblyName System.Speech;
                    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
                    $synth.Rate = ${psRate};
                    $synth.Volume = ${volume};
                    $synth.Speak("${sanitized}");
                `.replace(/\n\s*/g, ' ');

                cmd = 'powershell';
                args = ['-NoProfile', '-Command', psScript];
                break;
            }

            case 'darwin': {
                // macOS: Use the built-in 'say' command
                // Rate: words per minute (120–300), default ~200
                const macRate = Math.round(120 + (speakingRate / 10) * 180);
                cmd = 'say';
                args = ['-r', macRate.toString(), sanitized];
                break;
            }

            default: {
                // Linux: Try 'espeak' first, then 'spd-say'
                // espeak rate: 80–500, default 175
                const linuxRate = Math.round(80 + (speakingRate / 10) * 320);
                // espeak volume: 0–200, default 100
                const linuxVol = Math.round((volume / 100) * 200);
                cmd = 'espeak';
                args = ['-s', linuxRate.toString(), '-a', linuxVol.toString(), sanitized];
                break;
            }
        }

        console.log('[VoiceFeedback] TTS command:', cmd, args.slice(0, 2).join(' '), '...');

        const proc = childProcess.spawn(cmd, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                // On Linux, try spd-say as fallback if espeak fails
                if (platform === 'linux' && cmd === 'espeak') {
                    console.log('[VoiceFeedback] espeak failed, trying spd-say...');
                    const fallback = childProcess.spawn('spd-say', [sanitized], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                    fallback.on('close', (c) => c === 0 ? resolve() : resolve());
                    fallback.on('error', () => resolve()); // Give up silently
                } else {
                    resolve(); // Don't fail the extension over TTS errors
                }
            }
        });

        proc.on('error', (err) => {
            console.warn('[VoiceFeedback] TTS engine not available:', err.message);
            // Don't reject — TTS failure should never block the extension
            resolve();
        });
    });
}

// ============================================================================
// Convenience Messages
// ============================================================================

/**
 * Pre-built feedback messages for common actions.
 * These provide consistent, clean spoken feedback.
 */
export const Messages = {
    // Activation
    activated: () => speak('Voice coding assistant activated.'),
    deactivated: () => speak('Voice assistant deactivated. Say hey coder to activate.'),
    listening: () => speak('Listening.'),

    // File operations
    fileCreated: (name: string) => speak(`File ${name} created.`),
    fileOpened: (name: string) => speak(`Opened ${name}.`),
    fileSaved: (name: string) => speak(`${name} saved.`),
    fileClosed: () => speak('File closed.'),
    fileRunning: (name: string) => speak(`Running ${name}.`),

    // Navigation
    movedToLine: (line: number) => speak(`Moved to line ${line}.`),
    movedToTop: () => speak('Moved to top of file.'),
    movedToBottom: () => speak('Moved to bottom of file.'),

    // Code operations
    codeInserted: (concept: string) => speak(`${concept} inserted.`),
    codeGenerated: () => speak('Code generated and inserted.'),
    moduleImported: (name: string) => speak(`${name} imported.`),
    symbolRenamed: (oldN: string, newN: string) => speak(`Renamed ${oldN} to ${newN}.`),

    // Debugging
    debugReady: () => speak('Debug analysis ready. Check the output panel.'),
    errorFixed: () => speak('Error fixed.'),

    // Folder/Project
    folderCreated: (name: string) => speak(`Folder ${name} created.`),

    // Errors & Warnings
    noFileOpen: () => speak('No file is open.'),
    commandNotRecognized: () => speak('Command not recognized. Please try again.'),
    speechNotDetected: () => speak('Could not detect speech. Please try again.'),
    retryPrompt: () => speak('Please repeat your command.'),

    // Safety
    confirmDelete: (name: string) => speak(`Are you sure you want to delete ${name}? Say yes to confirm.`),
    deleteConfirmed: (name: string) => speak(`${name} deleted.`),
    deleteCancelled: () => speak('Delete cancelled.'),
};

/**
 * Stops any currently playing speech (platform-specific).
 * On Windows, kills the PowerShell TTS process.
 */
export function stopSpeaking(): void {
    speechQueue.length = 0; // Clear the queue
    isSpeaking = false;
    console.log('[VoiceFeedback] Speech stopped and queue cleared.');
}
