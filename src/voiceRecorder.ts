// ============================================================================
// Voice Recorder Module
// ============================================================================
// Handles microphone audio capture using SoX (Sound eXchange).
//
// WHY SoX?
//   SoX is a cross-platform command-line audio tool. We use it because:
//   - Works on Windows, macOS, and Linux
//   - No native Node.js audio bindings needed (those cause build issues)
//   - Reliable microphone capture with configurable sample rate
//   - Outputs WAV format that Whisper can read directly
//
// AUDIO FORMAT:
//   - Sample rate: 16000 Hz (16kHz) — required by Whisper
//   - Channels: 1 (mono) — speech doesn't need stereo
//   - Bit depth: 16-bit — standard quality for speech
//   - Format: WAV — uncompressed, no codec issues
//
// ARCHITECTURE:
//   Microphone → SoX process → WAV file → (passed to speechToText module)
// ============================================================================

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';

/**
 * Configuration for audio recording.
 */
export interface RecordingConfig {
    /** How long to record in milliseconds (default: 7000 = 7 seconds) */
    durationMs: number;
    /** Custom output file path. If not provided, a temp file is used. */
    outputPath?: string;
}

/**
 * Result of an audio recording session.
 */
export interface RecordingResult {
    /** Absolute path to the recorded WAV file */
    filePath: string;
    /** Duration of the recording in milliseconds */
    durationMs: number;
    /** File size in bytes */
    sizeBytes: number;
}

/**
 * Records audio from the system microphone using SoX.
 *
 * SoX command breakdown:
 *   Windows: sox -t waveaudio default -r 16000 -c 1 -b 16 -t wav <file> trim 0 <seconds>
 *   Linux/Mac: sox -d -r 16000 -c 1 -b 16 -t wav <file> trim 0 <seconds>
 *
 * @param config - Recording configuration
 * @returns RecordingResult with file path and metadata
 * @throws Error if SoX is not installed, microphone is unavailable, or recording fails
 */
export async function recordAudio(config: RecordingConfig): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
        try {
            const durationSec = config.durationMs / 1000;

            // Generate a temp file path if none was provided
            const outputPath = config.outputPath ||
                path.join(os.tmpdir(), `voice-coding-${Date.now()}.wav`);

            console.log('[VoiceRecorder] Starting microphone recording...');
            console.log('[VoiceRecorder] Duration:', durationSec, 'seconds');
            console.log('[VoiceRecorder] Output:', outputPath);

            const isWindows = os.platform() === 'win32';

            // Build SoX arguments based on platform
            const soxArgs = isWindows
                ? [
                    '-t', 'waveaudio', 'default',   // Windows: waveaudio driver
                    '-r', '16000',                   // 16kHz sample rate
                    '-c', '1',                       // Mono
                    '-b', '16',                      // 16-bit
                    '-t', 'wav',                     // WAV output format
                    outputPath,                      // Output file
                    'trim', '0', durationSec.toString(),  // Duration
                ]
                : [
                    '-d',                            // macOS/Linux: default device
                    '-r', '16000',
                    '-c', '1',
                    '-b', '16',
                    '-t', 'wav',
                    outputPath,
                    'trim', '0', durationSec.toString(),
                ];

            console.log('[VoiceRecorder] SoX command: sox', soxArgs.join(' '));

            const soxProcess = childProcess.spawn('sox', soxArgs, {
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stderrOutput = '';

            soxProcess.stderr.on('data', (data: Buffer) => {
                stderrOutput += data.toString();
                console.log('[VoiceRecorder] SoX:', data.toString().trim());
            });

            soxProcess.on('close', (code: number | null) => {
                if (code !== 0) {
                    console.error('[VoiceRecorder] SoX exited with code:', code);
                    reject(new Error(
                        `Microphone recording failed (SoX exit code ${code}).\n` +
                        `SoX error: ${stderrOutput}\n\n` +
                        `Troubleshooting:\n` +
                        `  1. Is SoX installed? Run: sox --version\n` +
                        `  2. Is your microphone connected and enabled?\n` +
                        `  3. Windows: Check Settings → Privacy → Microphone → Allow apps`
                    ));
                    return;
                }

                // Verify the file exists and has content
                if (!fs.existsSync(outputPath)) {
                    reject(new Error('Recording file was not created by SoX.'));
                    return;
                }

                const stats = fs.statSync(outputPath);
                console.log('[VoiceRecorder] Recording saved:', stats.size, 'bytes');

                // A valid WAV file with any audio should be > 1KB
                if (stats.size < 1000) {
                    reject(new Error(
                        'Recording file is too small — no audio captured.\n\n' +
                        'Check:\n' +
                        '  1. Your microphone is connected\n' +
                        '  2. Microphone is not muted\n' +
                        '  3. Windows: Settings → Privacy → Microphone → Allow apps'
                    ));
                    return;
                }

                resolve({
                    filePath: outputPath,
                    durationMs: config.durationMs,
                    sizeBytes: stats.size,
                });
            });

            soxProcess.on('error', (err: Error) => {
                if (err.message.includes('ENOENT')) {
                    reject(new Error(
                        'SoX is NOT installed or not in PATH!\n\n' +
                        'Install SoX:\n' +
                        '  1. Download: https://sourceforge.net/projects/sox/files/sox/14.4.2/\n' +
                        '  2. Install it\n' +
                        '  3. Add SoX folder to your system PATH\n' +
                        '  4. Restart VS Code\n\n' +
                        'Verify: Open a terminal and run "sox --version"'
                    ));
                } else {
                    reject(new Error(`Failed to start SoX: ${err.message}`));
                }
            });

        } catch (err: any) {
            reject(new Error(`Failed to start recording: ${err.message}`));
        }
    });
}

/**
 * Cleans up a temporary audio file after it's no longer needed.
 * Silently ignores errors (file may have already been deleted).
 *
 * @param filePath - Path to the audio file to delete
 */
export function cleanupAudioFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('[VoiceRecorder] Temporary audio file deleted:', filePath);
        }
    } catch {
        // Silently ignore cleanup errors
    }
}
