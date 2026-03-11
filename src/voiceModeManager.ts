// ============================================================================
// Voice Mode Manager Module
// ============================================================================
// Manages the two listening states of the voice coding assistant:
//
//   PASSIVE MODE (default):
//     - Continuously records short audio clips (3 seconds)
//     - Transcribes each clip with Whisper
//     - Checks ONLY for wake phrases ("hey coder")
//     - Very low CPU: only checking a few words per clip
//     - Ignores all other speech (privacy-friendly)
//
//   ACTIVE MODE (after wake word detected):
//     - Records longer audio clips (7 seconds, configurable)
//     - Transcribes and processes as full commands
//     - Routes commands through the command parser
//     - Checks for deactivation phrases to return to passive mode
//     - Auto-deactivates after a configurable timeout of no commands
//
// STATE DIAGRAM:
//                      wake word detected
//   ┌──────────┐    ─────────────────────>    ┌──────────┐
//   │  PASSIVE  │                              │  ACTIVE  │
//   │  MODE     │    <─────────────────────    │  MODE    │
//   └──────────┘       deactivation phrase     └──────────┘
//        │                or timeout                │
//        │                                          │
//        └─── Listens for                           └─── Processes full
//             wake words only                            voice commands
//
// SAFETY:
//   - Passive mode records very short clips (3s) and ONLY checks for
//     wake phrases. No commands are executed. No data is sent to AI.
//   - Active mode has a timeout (default 2 minutes). If the user stops
//     speaking, it returns to passive mode automatically.
//   - The user can always say "stop" or "sleep" to deactivate immediately.
//
// ARCHITECTURE:
//   VoiceModeManager.startPassiveListening()
//     → short record → Whisper → wakeWordDetector → found? → ACTIVE
//       → long record → Whisper → commandParser → executeCommand
//         → done → listen for next command (stay ACTIVE)
//           → deactivation phrase or timeout → back to PASSIVE
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { recordAudio, cleanupAudioFile } from './voiceRecorder';
import { transcribeAudio, WhisperModelSize } from './speechToText';
import { checkWakeWord, extractCommandAfterWake, isOnlyWakeWord } from './wakeWordDetector';
import { speak, speakAsync, Messages } from './voiceFeedback';

// ============================================================================
// Types
// ============================================================================

/**
 * The two possible states of the voice mode manager.
 */
export enum VoiceMode {
    /** Listening only for wake phrases */
    PASSIVE = 'PASSIVE',
    /** Processing full voice commands */
    ACTIVE = 'ACTIVE',
    /** Not listening at all */
    OFF = 'OFF',
}

/**
 * Callback for when a voice command is ready to be processed.
 * The extension.ts file provides this callback to handle commands.
 */
export type CommandCallback = (transcribedText: string) => Promise<void>;

/**
 * Callback for status bar updates.
 */
export type StatusCallback = (mode: VoiceMode) => void;

// ============================================================================
// Configuration
// ============================================================================

/** Duration of passive listening clips (short, just for wake word) */
const PASSIVE_RECORD_DURATION_MS = 3000; // 3 seconds

/** How long to wait before auto-deactivating if no commands (ms) */
const AUTO_DEACTIVATE_TIMEOUT_MS = 120000; // 2 minutes

/** Delay between passive listening cycles (ms) */
const PASSIVE_CYCLE_DELAY_MS = 500;

/** Delay between active listening cycles (ms) */
const ACTIVE_CYCLE_DELAY_MS = 300;

// ============================================================================
// State
// ============================================================================

/** Current mode */
let currentMode: VoiceMode = VoiceMode.OFF;

/** Whether the listening loop should continue */
let shouldContinue = false;

/** Timer for auto-deactivation */
let deactivateTimer: ReturnType<typeof setTimeout> | null = null;

/** Timestamp of last active command */
let lastCommandTime = 0;

/** Whether we're currently in a recording cycle */
let isInCycle = false;

/** The callback to invoke when a command is ready */
let onCommandReady: CommandCallback | null = null;

/** The callback to invoke on status changes */
let onStatusChange: StatusCallback | null = null;

/** Whether we're waiting for a safety confirmation */
let awaitingConfirmation = false;

/** The pending safety callback (e.g. file delete confirmation) */
let pendingConfirmationCallback: ((confirmed: boolean) => void) | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Gets the current voice mode.
 */
export function getMode(): VoiceMode {
    return currentMode;
}

/**
 * Registers the callback that will be called when a voice command
 * has been transcribed and is ready for processing.
 *
 * @param callback - Async function that receives the transcribed text
 */
export function onCommand(callback: CommandCallback): void {
    onCommandReady = callback;
}

/**
 * Registers a callback for mode changes (for status bar updates).
 *
 * @param callback - Function called with the new mode
 */
export function onModeChange(callback: StatusCallback): void {
    onStatusChange = callback;
}

/**
 * Starts the continuous listening system in PASSIVE mode.
 * The system will listen for wake words and transition to ACTIVE
 * mode when one is detected.
 *
 * This is the main entry point for hands-free operation.
 */
export async function startPassiveListening(): Promise<void> {
    if (currentMode !== VoiceMode.OFF) {
        console.log('[ModeManager] Already listening in mode:', currentMode);
        return;
    }

    console.log('[ModeManager] Starting passive listening...');
    setMode(VoiceMode.PASSIVE);
    shouldContinue = true;

    speakAsync('Voice assistant ready. Say hey coder to activate.');

    // Start the passive listening loop
    passiveLoop();
}

/**
 * Immediately activates the assistant (ACTIVE mode).
 * Used when the user activates via command palette or keyboard shortcut
 * instead of voice.
 */
export async function activateNow(): Promise<void> {
    console.log('[ModeManager] Direct activation requested.');
    setMode(VoiceMode.ACTIVE);
    shouldContinue = true;
    resetDeactivateTimer();

    await Messages.activated();

    // Start the active listening loop
    activeLoop();
}

/**
 * Deactivates back to PASSIVE mode.
 * If continuous listening is enabled, returns to passive listening.
 * Otherwise, stops completely.
 */
export async function deactivateToPassive(): Promise<void> {
    console.log('[ModeManager] Deactivating to passive mode...');
    clearDeactivateTimer();

    setMode(VoiceMode.PASSIVE);

    await Messages.deactivated();

    // Restart passive loop after a short delay
    setTimeout(() => {
        if (currentMode === VoiceMode.PASSIVE && shouldContinue) {
            passiveLoop();
        }
    }, 1000);
}

/**
 * Stops all listening completely.
 */
export function stopAll(): void {
    console.log('[ModeManager] Stopping all listening.');
    shouldContinue = false;
    clearDeactivateTimer();
    setMode(VoiceMode.OFF);
    awaitingConfirmation = false;
    pendingConfirmationCallback = null;
}

/**
 * Returns whether the manager is currently in any active listening state.
 */
export function isListening(): boolean {
    return currentMode !== VoiceMode.OFF;
}

/**
 * Requests a voice-based safety confirmation.
 * The next voice input will be checked for "yes" or "no".
 *
 * @param promptMessage - The message to speak to the user
 * @returns Promise<boolean> - true if confirmed, false if denied
 */
export function requestConfirmation(promptMessage: string): Promise<boolean> {
    return new Promise(async (resolve) => {
        awaitingConfirmation = true;
        pendingConfirmationCallback = resolve;

        // Speak the confirmation prompt
        await speak(promptMessage);
    });
}

// ============================================================================
// Internal: Mode Management
// ============================================================================

function setMode(mode: VoiceMode): void {
    currentMode = mode;
    console.log('[ModeManager] Mode changed to:', mode);

    if (onStatusChange) {
        onStatusChange(mode);
    }
}

function resetDeactivateTimer(): void {
    clearDeactivateTimer();
    lastCommandTime = Date.now();

    deactivateTimer = setTimeout(async () => {
        if (currentMode === VoiceMode.ACTIVE) {
            console.log('[ModeManager] Auto-deactivating due to timeout.');
            await speak('No commands detected. Going to sleep.');
            await deactivateToPassive();
        }
    }, AUTO_DEACTIVATE_TIMEOUT_MS);
}

function clearDeactivateTimer(): void {
    if (deactivateTimer) {
        clearTimeout(deactivateTimer);
        deactivateTimer = null;
    }
}

// ============================================================================
// Internal: Passive Listening Loop
// ============================================================================

/**
 * The passive listening loop:
 *   1. Record a short clip (3 seconds)
 *   2. Transcribe with Whisper
 *   3. Check for wake word
 *   4. If found → switch to active mode
 *   5. If not → loop again
 */
async function passiveLoop(): Promise<void> {
    console.log('[ModeManager] Passive loop starting...');

    while (shouldContinue && currentMode === VoiceMode.PASSIVE) {
        if (isInCycle) {
            await delay(PASSIVE_CYCLE_DELAY_MS);
            continue;
        }

        isInCycle = true;
        const audioPath = path.join(os.tmpdir(), `vc-passive-${Date.now()}.wav`);

        try {
            // Record a short clip
            const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
            const whisperModel = config.get<string>('whisperModel', 'base') as WhisperModelSize;

            await recordAudio({
                durationMs: PASSIVE_RECORD_DURATION_MS,
                outputPath: audioPath,
            });

            // Transcribe
            const result = await transcribeAudio(audioPath, whisperModel);

            if (result.text && result.text.trim().length > 0) {
                console.log('[ModeManager] Passive heard:', result.text);

                // Check for wake word
                const wakeResult = checkWakeWord(result.text);

                if (wakeResult.isWakeWord) {
                    console.log('[ModeManager] 🎤 Wake word detected! Activating...');

                    // Check if there's a command after the wake word
                    const commandAfterWake = extractCommandAfterWake(result.text);
                    const isJustWake = isOnlyWakeWord(result.text);

                    setMode(VoiceMode.ACTIVE);
                    resetDeactivateTimer();

                    await Messages.activated();

                    if (!isJustWake && commandAfterWake !== result.text.trim()) {
                        // User said wake word + command in one breath
                        // e.g., "Hey coder create a python file"
                        console.log('[ModeManager] Command after wake:', commandAfterWake);
                        if (onCommandReady) {
                            await onCommandReady(commandAfterWake);
                        }
                        resetDeactivateTimer();
                    }

                    // Start active listening loop
                    isInCycle = false;
                    activeLoop();
                    return; // Exit passive loop
                }
            }

        } catch (err: any) {
            // Passive mode errors are non-critical — just log and continue
            console.warn('[ModeManager] Passive cycle error:', err.message);
        } finally {
            cleanupAudioFile(audioPath);
            isInCycle = false;
        }

        // Small delay before next cycle
        await delay(PASSIVE_CYCLE_DELAY_MS);
    }

    console.log('[ModeManager] Passive loop ended. Mode:', currentMode);
}

// ============================================================================
// Internal: Active Listening Loop
// ============================================================================

/**
 * The active listening loop:
 *   1. Record a longer clip (7 seconds, configurable)
 *   2. Transcribe with Whisper
 *   3. Check for deactivation phrase → if found, go to passive
 *   4. Check for confirmation/denial (if awaiting)
 *   5. Otherwise, dispatch as a voice command
 *   6. Reset the auto-deactivation timer
 *   7. Loop
 */
async function activeLoop(): Promise<void> {
    console.log('[ModeManager] Active loop starting...');

    while (shouldContinue && currentMode === VoiceMode.ACTIVE) {
        if (isInCycle) {
            await delay(ACTIVE_CYCLE_DELAY_MS);
            continue;
        }

        isInCycle = true;
        const audioPath = path.join(os.tmpdir(), `vc-active-${Date.now()}.wav`);

        try {
            const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
            const recordingDuration = config.get<number>('recordingDurationMs', 7000);
            const whisperModel = config.get<string>('whisperModel', 'base') as WhisperModelSize;

            // Record
            await recordAudio({
                durationMs: recordingDuration,
                outputPath: audioPath,
            });

            // Transcribe
            const result = await transcribeAudio(audioPath, whisperModel);

            if (!result.text || result.text.trim().length === 0) {
                // No speech detected — continue listening
                console.log('[ModeManager] Active: no speech detected, continuing...');
                isInCycle = false;
                continue;
            }

            console.log('[ModeManager] Active heard:', result.text);

            // ── Check for deactivation ─────────────────────────────
            const wakeResult = checkWakeWord(result.text);

            if (wakeResult.isDeactivation) {
                console.log('[ModeManager] ✋ Deactivation command received.');
                isInCycle = false;
                await deactivateToPassive();
                return; // Exit active loop (passive loop will start)
            }

            // ── Check for safety confirmation ──────────────────────
            if (awaitingConfirmation && pendingConfirmationCallback) {
                if (wakeResult.isConfirmation) {
                    console.log('[ModeManager] ✅ Confirmation received.');
                    awaitingConfirmation = false;
                    const cb = pendingConfirmationCallback;
                    pendingConfirmationCallback = null;
                    cb(true);
                    resetDeactivateTimer();
                    isInCycle = false;
                    continue;
                } else if (wakeResult.isDenial) {
                    console.log('[ModeManager] ❌ Denial received.');
                    awaitingConfirmation = false;
                    const cb = pendingConfirmationCallback;
                    pendingConfirmationCallback = null;
                    cb(false);
                    resetDeactivateTimer();
                    isInCycle = false;
                    continue;
                }
                // If neither confirmation nor denial, treat as a new command
                // and cancel the pending confirmation
                awaitingConfirmation = false;
                if (pendingConfirmationCallback) {
                    pendingConfirmationCallback(false);
                    pendingConfirmationCallback = null;
                }
            }

            // ── Process as a command ───────────────────────────────
            if (onCommandReady) {
                // Strip any leading wake word if user said it again
                const commandText = extractCommandAfterWake(result.text);
                await onCommandReady(commandText);
            }

            resetDeactivateTimer();

        } catch (err: any) {
            console.error('[ModeManager] Active cycle error:', err.message);
            // Don't break the loop — just continue listening
            await speak('An error occurred. Please try again.');
        } finally {
            cleanupAudioFile(audioPath);
            isInCycle = false;
        }

        // Small delay before next cycle
        await delay(ACTIVE_CYCLE_DELAY_MS);
    }

    console.log('[ModeManager] Active loop ended. Mode:', currentMode);
}

// ============================================================================
// Utility
// ============================================================================

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
