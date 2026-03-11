// ============================================================================
// Wake Word Detector Module
// ============================================================================
// Detects activation and deactivation phrases in transcribed text.
//
// WHY THIS MODULE?
//   Users with hand disabilities cannot press keyboard shortcuts to start
//   the assistant. Instead, they say a wake phrase like "Hey Coder" and
//   the assistant activates automatically.
//
// HOW IT WORKS:
//   1. The VoiceModeManager continuously records short audio clips (passive mode)
//   2. Each clip is transcribed by Whisper
//   3. The transcribed text is passed to this module
//   4. If a WAKE phrase is found → switch to ACTIVE mode
//   5. If a DEACTIVATION phrase is found → switch back to PASSIVE mode
//
// WAKE PHRASES (activate the assistant):
//   "hey coder"
//   "start voice assistant"
//   "activate coding assistant"
//   "start coding"
//   "voice assistant"
//   "wake up"
//
// DEACTIVATION PHRASES (put assistant to sleep):
//   "stop voice assistant"
//   "deactivate coding assistant"
//   "sleep assistant"
//   "turn off voice coding"
//   "stop listening"
//   "go to sleep"
//   "goodbye"
//
// MATCHING APPROACH:
//   We use fuzzy matching because speech recognition is imperfect.
//   "hey coder" might be transcribed as "hey coda" or "hey koder".
//   The module uses substring matching with normalized text.
//
// ARCHITECTURE:
//   Transcribed text → wakeWordDetector.check() → { isWake, isDeactivate, ... }
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/**
 * Result of checking text against wake/deactivation phrases.
 */
export interface WakeWordResult {
    /** Whether a wake/activation phrase was detected */
    isWakeWord: boolean;

    /** Whether a deactivation/sleep phrase was detected */
    isDeactivation: boolean;

    /** The specific phrase that was matched */
    matchedPhrase: string | null;

    /** The original text that was checked */
    originalText: string;

    /** Whether a safety confirmation ("yes"/"no") was detected */
    isConfirmation?: boolean;

    /** Whether a denial ("no"/"cancel") was detected */
    isDenial?: boolean;
}

// ============================================================================
// Phrase Definitions
// ============================================================================

/**
 * Wake phrases that activate the assistant.
 * These are checked as substrings of the normalized transcription.
 * Order matters — more specific phrases first to avoid false matches.
 */
const WAKE_PHRASES: string[] = [
    'hey coder',
    'hey coda',              // common Whisper mis-transcription
    'hey koder',             // accent variation (Indian: k/c confusion)
    'hey codar',             // Indian accent: trailing 'r' → 'ar'
    'hei coder',             // Indian accent: 'hey' → 'hei'
    'hey kodar',             // Indian accent: combined k + ar
    'hay coder',             // Indian accent: 'hey' → 'hay'
    'a coder',               // Indian accent: 'hey' dropped by Whisper
    'start voice assistant',
    'activate coding assistant',
    'activate voice coding',
    'start coding assistant',
    'start voice coding',
    'start coding',
    'voice assistant activate',
    'voice assistant start',
    'wake up',
    'wake up assistant',
    'activate assistant',
];

/**
 * Deactivation phrases that put the assistant to sleep.
 */
const DEACTIVATION_PHRASES: string[] = [
    'stop voice assistant',
    'deactivate coding assistant',
    'deactivate voice coding',
    'sleep assistant',
    'turn off voice coding',
    'turn off assistant',
    'stop listening',
    'stop coding assistant',
    'stop coding',
    'go to sleep',
    'goodbye assistant',
    'goodbye coder',
    'goodbye',
    'good bye',
    'deactivate',
    'sleep',
    // Indian accent variations
    'stop voice coding',
    'bye bye',
    'bye coder',
];

/**
 * Confirmation phrases (used for safety confirmations like "delete file").
 */
const CONFIRMATION_PHRASES: string[] = [
    'yes',
    'yes please',
    'confirm',
    'do it',
    'go ahead',
    'affirmative',
    'correct',
    'yes delete',
    'yes confirm',
    // Indian accent variations
    'haan',               // Hindi yes
    'ha',                 // Hindi yes (informal)
    'theek hai',          // Hindi "okay"
    'ok',
    'okay',
];

/**
 * Denial phrases (used to cancel safety confirmations).
 */
const DENIAL_PHRASES: string[] = [
    'no',
    'cancel',
    'stop',
    'don\'t',
    'do not',
    'negative',
    'abort',
    'never mind',
    'no cancel',
    'no don\'t',
    // Indian accent variations
    'nahi',               // Hindi no
    'nahi cancel',
    'mat karo',           // Hindi "don't do"
    'ruko',               // Hindi "stop"
];

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalizes text for matching by:
 *   - Converting to lowercase
 *   - Removing punctuation
 *   - Collapsing multiple spaces
 *   - Trimming whitespace
 *
 * This handles variations in how Whisper transcribes speech:
 *   "Hey, Coder!" → "hey coder"
 *   "Start voice-assistant" → "start voice assistant"
 *
 * @param text - Raw transcribed text
 * @returns Normalized text
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()\-]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ')              // Collapse spaces
        .trim();
}

// ============================================================================
// Core: Check for Wake/Deactivation Phrases
// ============================================================================

/**
 * Checks if the transcribed text contains a wake word, deactivation phrase,
 * or confirmation/denial.
 *
 * The function normalizes the text and then checks against all phrase lists.
 * First match wins.
 *
 * @param text - The transcribed text to check
 * @returns WakeWordResult indicating what was detected
 *
 * @example
 *   checkWakeWord("hey coder")
 *   // → { isWakeWord: true, isDeactivation: false, matchedPhrase: "hey coder" }
 *
 *   checkWakeWord("stop voice assistant")
 *   // → { isWakeWord: false, isDeactivation: true, matchedPhrase: "stop voice assistant" }
 *
 *   checkWakeWord("create a python file")
 *   // → { isWakeWord: false, isDeactivation: false, matchedPhrase: null }
 */
export function checkWakeWord(text: string): WakeWordResult {
    const normalized = normalize(text);

    console.log('[WakeWordDetector] Checking:', `"${normalized}"`);

    // Check deactivation first (higher priority — user wants to stop)
    for (const phrase of DEACTIVATION_PHRASES) {
        if (normalized.includes(phrase)) {
            console.log('[WakeWordDetector] ✋ Deactivation detected:', phrase);
            return {
                isWakeWord: false,
                isDeactivation: true,
                matchedPhrase: phrase,
                originalText: text,
            };
        }
    }

    // Check wake phrases
    for (const phrase of WAKE_PHRASES) {
        if (normalized.includes(phrase)) {
            console.log('[WakeWordDetector] 🎤 Wake word detected:', phrase);
            return {
                isWakeWord: true,
                isDeactivation: false,
                matchedPhrase: phrase,
                originalText: text,
            };
        }
    }

    // Check confirmations
    for (const phrase of CONFIRMATION_PHRASES) {
        if (normalized === phrase || normalized.startsWith(phrase + ' ')) {
            return {
                isWakeWord: false,
                isDeactivation: false,
                matchedPhrase: phrase,
                originalText: text,
                isConfirmation: true,
            };
        }
    }

    // Check denials
    for (const phrase of DENIAL_PHRASES) {
        if (normalized === phrase || normalized.startsWith(phrase + ' ')) {
            return {
                isWakeWord: false,
                isDeactivation: false,
                matchedPhrase: phrase,
                originalText: text,
                isDenial: true,
            };
        }
    }

    // Nothing matched
    return {
        isWakeWord: false,
        isDeactivation: false,
        matchedPhrase: null,
        originalText: text,
    };
}

/**
 * Strips the wake word from the beginning of a command.
 *
 * Example:
 *   extractCommandAfterWake("hey coder create a python file")
 *   → "create a python file"
 *
 *   extractCommandAfterWake("start coding create function")
 *   → "create function"
 *
 * If no wake word is found, returns the original text.
 *
 * @param text - Text that may start with a wake word
 * @returns The text with the wake word removed
 */
export function extractCommandAfterWake(text: string): string {
    const normalized = normalize(text);

    // Try to find and remove the wake phrase from the beginning
    for (const phrase of WAKE_PHRASES) {
        if (normalized.startsWith(phrase)) {
            const remainder = normalized.substring(phrase.length).trim();
            if (remainder.length > 0) {
                console.log('[WakeWordDetector] Extracted command after wake:', remainder);
                return remainder;
            }
        }
    }

    return text.trim();
}

/**
 * Quick check: does the text contain ONLY a wake word with no additional command?
 *
 * "hey coder" → true (just the wake word)
 * "hey coder create file" → false (has a command after the wake word)
 *
 * @param text - Text to check
 * @returns true if text is ONLY a wake phrase
 */
export function isOnlyWakeWord(text: string): boolean {
    const normalized = normalize(text);

    for (const phrase of WAKE_PHRASES) {
        if (normalized === phrase) {
            return true;
        }
    }

    return false;
}
