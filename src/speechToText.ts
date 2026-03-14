// ============================================================================
// Speech-to-Text Module (Deepgram Only)
// ============================================================================
// Converts recorded audio to text using Deepgram Cloud API.
// ============================================================================

import * as vscode from 'vscode';
import * as fs from 'fs';
import axios from 'axios';

/**
 * Result from transcription.
 */
export interface TranscriptionResult {
    /** The primary transcribed text */
    text: string;
    /** Detected language */
    language?: string;
    /** Whether VAD detected silence */
    silent?: boolean;
    /** Which pipeline was used: "deepgram" */
    pipeline?: string;
    /** Error message if transcription failed */
    error?: string;
}

/**
 * Transcription mode affects pipeline behavior.
 */
export type TranscriptionMode = 'passive' | 'active';

/**
 * Returns the capabilities of the running STT module.
 */
export function getCapabilities() {
    return {
        vosk: false,
        whisper: false,
        vad: true,
        pipeline: 'deepgram',
    };
}

/**
 * Transcribes an audio file using Deepgram.
 *
 * @param audioFilePath - Absolute path to the WAV audio file
 * @param mode - "passive" for wake-word detection, "active" for full commands
 * @returns TranscriptionResult
 */
export async function transcribeAudio(
    audioFilePath: string,
    mode: TranscriptionMode = 'active'
): Promise<TranscriptionResult> {
    const config = vscode.workspace.getConfiguration('voiceCodingAssistant');
    const apiKey = config.get<string>('deepgramApiKey', '') || process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
        throw new Error('Deepgram API Key is missing. Please add it in .env or VS Code settings.');
    }

    try {
        const fileData = fs.readFileSync(audioFilePath);
        console.log(`[SpeechToText] Transcribing with Deepgram (${mode})...`);
        
        const response = await axios.post(
            'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true',
            fileData,
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Authorization': `Token ${apiKey}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'audio/wav',
                },
                timeout: 20000
            }
        );

        let transcript = response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const isSilent = transcript.trim().length === 0;
        
        // Clean up Deepgram punctuation if needed, removing trailing periods for simpler matching
        if (transcript && transcript.endsWith('.')) {
            // If it's a short command, might be better to strip the period for consistency
            if (transcript.split(' ').length < 10) {
               transcript = transcript.replace(/\.$/, '');
            }
        }

        console.log(`[SpeechToText] Deepgram result: "${transcript}"`);

        return {
            text: transcript,
            pipeline: 'deepgram',
            silent: isSilent,
            language: 'en'
        };

    } catch (err: any) {
        console.error('[SpeechToText] Deepgram STT error:', err.message);
        if (err.response) {
            console.error('[SpeechToText] Deepgram Error Status:', err.response.status);
            console.error('[SpeechToText] Deepgram Error Data:', err.response.data);
        }
        throw new Error(`Deepgram transcription failed: ${err.message}`);
    }
}

/**
 * Stops any STT services (no-op for Deepgram).
 */
export function stopSTTService(): void {
    console.log('[SpeechToText] Deepgram requires no background service to stop.');
}
