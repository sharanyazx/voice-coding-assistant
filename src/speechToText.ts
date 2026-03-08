// ============================================================================
// Speech-to-Text Module (Whisper Integration)
// ============================================================================
// Converts recorded audio to text using OpenAI's Whisper model.
//
// WHY WHISPER?
//   Whisper is OpenAI's open-source speech recognition model that:
//   - Works offline (no internet needed for transcription)
//   - Handles multiple English accents excellently:
//     • Indian English
//     • American English
//     • British English
//     • Australian English
//   - Runs locally via Python (privacy — audio never leaves your computer)
//   - Multiple model sizes: tiny → base → small → medium → large
//
// HOW IT WORKS:
//   1. We spawn a Python subprocess
//   2. Python loads the Whisper model
//   3. Whisper processes the WAV audio file
//   4. Returns transcribed text as JSON
//
// PREREQUISITES:
//   - Python 3.8+ installed
//   - pip install openai-whisper
//   - FFmpeg installed (Whisper uses it internally)
//
// ARCHITECTURE:
//   WAV file → Python subprocess → Whisper model → JSON output → TypeScript
// ============================================================================

import * as os from 'os';
import * as childProcess from 'child_process';

/**
 * Result from Whisper speech-to-text transcription.
 */
export interface TranscriptionResult {
    /** The transcribed text */
    text: string;
    /** Detected language (e.g., "en" for English) */
    language?: string;
    /** Confidence level if available */
    confidence?: number;
}

/**
 * Whisper model sizes — larger = more accurate but slower.
 *
 *   tiny   (~39M params)  → Fastest, least accurate
 *   base   (~74M params)  → Good balance for English
 *   small  (~244M params) → Better accent handling
 *   medium (~769M params) → Very good for all accents
 *   large  (~1550M params)→ Best quality, slowest
 */
export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large';

/**
 * Transcribes an audio file to text using OpenAI's Whisper.
 *
 * This function spawns a Python subprocess that:
 *   1. Imports the whisper library
 *   2. Loads the specified model size
 *   3. Transcribes the audio file
 *   4. Outputs JSON with the transcribed text
 *
 * @param audioFilePath - Absolute path to the WAV audio file
 * @param modelSize - Whisper model size (default: "base")
 * @returns TranscriptionResult with the transcribed text
 * @throws Error if Python/Whisper/FFmpeg is not installed or transcription fails
 */
export async function transcribeAudio(
    audioFilePath: string,
    modelSize: WhisperModelSize = 'base'
): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
        console.log('[SpeechToText] Starting transcription...');
        console.log('[SpeechToText] Audio file:', audioFilePath);
        console.log('[SpeechToText] Whisper model:', modelSize);

        // Python script that runs Whisper transcription
        // We use a raw string to avoid escape issues with file paths on Windows
        const escapedPath = audioFilePath.replace(/\\/g, '\\\\');
        const pythonScript = `
import whisper
import json
import sys

try:
    model = whisper.load_model("${modelSize}")
    result = model.transcribe("${escapedPath}")
    output = {
        "text": result["text"].strip(),
        "language": result.get("language", "en")
    }
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

        // Use 'python' on Windows, 'python3' on macOS/Linux
        const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';

        console.log('[SpeechToText] Running:', pythonCmd, '-c', '<whisper_script>');

        const proc = childProcess.spawn(pythonCmd, ['-c', pythonScript], {
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            // Whisper prints download/progress info to stderr — this is normal
            console.log('[SpeechToText] Whisper:', data.toString().trim());
        });

        proc.on('close', (code: number | null) => {
            if (code !== 0) {
                console.error('[SpeechToText] Whisper failed. stderr:', stderr);
                reject(new Error(
                    `Whisper transcription failed (exit code ${code}).\n` +
                    `Error: ${stderr}\n\n` +
                    `Make sure you have installed:\n` +
                    `  1. Python 3.8+: https://www.python.org/downloads/\n` +
                    `  2. Whisper: pip install openai-whisper\n` +
                    `  3. FFmpeg: https://ffmpeg.org/download.html\n\n` +
                    `Verify:\n` +
                    `  python -c "import whisper; print(whisper.__version__)"`
                ));
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) {
                    reject(new Error(`Whisper error: ${result.error}`));
                } else {
                    console.log('[SpeechToText] Transcription:', result.text);
                    console.log('[SpeechToText] Language:', result.language);
                    resolve({
                        text: result.text,
                        language: result.language,
                    });
                }
            } catch (parseErr) {
                // If JSON parse fails, try to use raw output
                const rawText = stdout.trim();
                if (rawText) {
                    console.warn('[SpeechToText] JSON parse failed, using raw output');
                    resolve({ text: rawText });
                } else {
                    reject(new Error(
                        'Could not parse Whisper output.\n' +
                        `stdout: ${stdout}\n` +
                        `stderr: ${stderr}`
                    ));
                }
            }
        });

        proc.on('error', (err: Error) => {
            if (err.message.includes('ENOENT')) {
                reject(new Error(
                    `Python is NOT installed or not in PATH!\n\n` +
                    `Install Python:\n` +
                    `  1. Download: https://www.python.org/downloads/\n` +
                    `  2. During install, CHECK "Add Python to PATH"\n` +
                    `  3. Restart VS Code\n\n` +
                    `Then install Whisper:\n` +
                    `  pip install openai-whisper`
                ));
            } else {
                reject(new Error(`Failed to start Python: ${err.message}`));
            }
        });
    });
}
