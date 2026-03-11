// ============================================================================
// AI Engine Module (OpenRouter Integration)
// ============================================================================
// Sends prompts to AI models via the OpenRouter API and returns generated code.
//
// WHY OPENROUTER?
//   OpenRouter provides access to 100+ AI models through one API:
//   - OpenAI GPT-4, GPT-3.5
//   - Anthropic Claude 3
//   - Meta LLaMA 3
//   - Google Gemini
//   - Mistral, Mixtral
//   - And many more (including free models!)
//
//   This means users can choose whichever model works best for them,
//   and switch models without changing code.
//
// HOW IT WORKS:
//   1. Receives a prompt (transcribed from voice)
//   2. Adds a system prompt that instructs the AI to output only code
//   3. Sends to OpenRouter API via HTTP POST
//   4. Returns the generated code, cleaned of markdown formatting
//
// API FORMAT:
//   POST https://openrouter.ai/api/v1/chat/completions
//   Headers: Authorization: Bearer <API_KEY>
//   Body: { model, messages[], temperature, max_tokens }
//
// ARCHITECTURE:
//   Voice text → Prompt builder → OpenRouter API → Response parser → Clean code
// ============================================================================

import axios from 'axios';
import { detectLanguage, getAIPromptContext } from './syntaxDetector';

// ============================================================================
// Types
// ============================================================================

/** Message format for the OpenRouter Chat Completions API */
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** Configuration for AI code generation */
export interface AIConfig {
    /** OpenRouter API key */
    apiKey: string;
    /** Model to use (e.g., "openai/gpt-3.5-turbo", "anthropic/claude-3-haiku") */
    model: string;
    /** Temperature: 0.0 = deterministic, 1.0 = creative (default: 0.2) */
    temperature?: number;
    /** Maximum tokens in response (default: 2048) */
    maxTokens?: number;
}

/** Result from AI code generation */
export interface AIResult {
    /** The generated code */
    code: string;
    /** The model that was used */
    model: string;
    /** Number of tokens used (if available) */
    tokensUsed?: number;
}

// ============================================================================
// Constants
// ============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * System prompt for general code generation.
 * Instructs the AI to output ONLY code without explanations.
 */
const CODE_GENERATION_PROMPT = `You are an expert programming assistant. The user will describe code they want using natural language (transcribed from voice commands).

RULES:
1. Generate ONLY the code. No explanations, no markdown fences, no commentary.
2. Write clean, production-quality code with proper indentation.
3. If the user specifies a programming language, use that language.
4. If no language is specified, default to Python.
5. Do NOT wrap the code in markdown code blocks (no \`\`\`).
6. Just output raw code, nothing else.
7. Include appropriate imports if needed.
8. Use descriptive variable and function names.`;

/**
 * System prompt for debugging — analyzes code and explains/fixes errors.
 */
const DEBUG_PROMPT = `You are an expert programming debugger. Analyze the code provided and:

1. Identify the error or issue
2. Explain what's wrong in simple terms
3. Provide the corrected code

Format your response as:
ERROR: <brief description of the error>
EXPLANATION: <simple explanation>
FIX:
<corrected code>

Keep explanations brief and beginner-friendly.`;

/**
 * System prompt for fixing errors — outputs only the fixed code.
 */
const FIX_ERROR_PROMPT = `You are an expert programmer. The user's code has an error. Fix it.

RULES:
1. Output ONLY the corrected code. No explanations.
2. Fix the error while keeping the rest of the code unchanged.
3. Do NOT wrap in markdown code blocks.
4. Just output the fixed code.`;

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generates code from a natural language prompt using OpenRouter AI.
 *
 * @param prompt - Natural language description of the code to generate
 * @param config - AI configuration (API key, model, etc.)
 * @returns AIResult with the generated code
 * @throws Error for API errors, network issues, or invalid responses
 */
export async function generateCode(
    prompt: string,
    config: AIConfig
): Promise<AIResult> {
    console.log('[AIEngine] Generating code...');
    console.log('[AIEngine] Model:', config.model);
    console.log('[AIEngine] Prompt:', prompt);

    // Detect current language and add context
    const langProfile = detectLanguage();
    const langContext = getAIPromptContext(langProfile);
    const systemPrompt = CODE_GENERATION_PROMPT + '\n\n' + langContext;

    console.log('[AIEngine] Language:', langProfile.name);

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    return callOpenRouter(messages, config);
}

/**
 * Analyzes code for debugging — explains errors and suggests fixes.
 *
 * @param code - The code to debug
 * @param lineNumber - Optional specific line to focus on
 * @param config - AI configuration
 * @returns AIResult with error analysis
 */
export async function debugCode(
    code: string,
    config: AIConfig,
    lineNumber?: number
): Promise<AIResult> {
    console.log('[AIEngine] Debugging code...');

    let prompt: string;
    if (lineNumber) {
        prompt = `Debug the following code, focusing on line ${lineNumber}:\n\n${code}`;
    } else {
        prompt = `Debug the following code and explain any errors:\n\n${code}`;
    }

    const messages: ChatMessage[] = [
        { role: 'system', content: DEBUG_PROMPT },
        { role: 'user', content: prompt },
    ];

    return callOpenRouter(messages, config);
}

/**
 * Fixes errors in code — returns only the corrected code.
 *
 * @param code - The code with errors
 * @param config - AI configuration
 * @returns AIResult with the fixed code
 */
export async function fixError(
    code: string,
    config: AIConfig
): Promise<AIResult> {
    console.log('[AIEngine] Fixing error...');

    const messages: ChatMessage[] = [
        { role: 'system', content: FIX_ERROR_PROMPT },
        { role: 'user', content: `Fix the errors in this code:\n\n${code}` },
    ];

    return callOpenRouter(messages, config);
}

/**
 * Generates a specific code construct (function, class, loop, etc.)
 * with context about what concept is being requested.
 *
 * @param concept - The coding concept ("function", "class", "loop", etc.)
 * @param description - Additional description from the voice command
 * @param config - AI configuration
 * @param existingCode - Optional existing code for context
 * @returns AIResult with the generated code
 */
export async function generateCodeConcept(
    concept: string,
    description: string,
    config: AIConfig,
    existingCode?: string
): Promise<AIResult> {
    console.log('[AIEngine] Generating', concept, ':', description);

    // Detect language for concept-specific generation
    const langProfile = detectLanguage();
    const langContext = getAIPromptContext(langProfile);

    let prompt = `Write a ${concept} in ${langProfile.name}`;
    if (description) {
        prompt += `: ${description}`;
    }

    // Add concept-specific hints
    switch (concept) {
        case 'function':
            prompt += `\n\nUse this function declaration style: ${langProfile.syntaxRules.functionDeclaration}`;
            prompt += `\nNaming convention: ${langProfile.namingConvention.functions}`;
            break;
        case 'class':
            prompt += `\n\nUse this class declaration style: ${langProfile.syntaxRules.classDeclaration}`;
            prompt += `\nNaming convention: ${langProfile.namingConvention.classes}`;
            break;
        case 'loop':
            prompt += `\n\nFor loop template: ${langProfile.syntaxRules.forLoopSyntax}`;
            prompt += `\nWhile loop template: ${langProfile.syntaxRules.whileLoopSyntax}`;
            break;
        case 'conditional':
            prompt += `\n\nConditional style: ${langProfile.syntaxRules.conditionalSyntax}`;
            break;
        case 'error_handling':
            prompt += `\n\nError handling style: ${langProfile.syntaxRules.errorHandling}`;
            break;
        case 'constructor':
            prompt += `\n\nClass with constructor template: ${langProfile.templates.classWithConstructor}`;
            break;
    }

    if (existingCode) {
        prompt += `\n\nExisting code context:\n${existingCode}`;
    }

    const systemPrompt = CODE_GENERATION_PROMPT + '\n\n' + langContext;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    return callOpenRouter(messages, config);
}

// ============================================================================
// API Communication
// ============================================================================

/**
 * Makes the actual HTTP request to the OpenRouter API.
 *
 * @param messages - Array of chat messages (system + user)
 * @param config - AI configuration
 * @returns AIResult with cleaned code output
 * @throws Detailed error for each type of API failure
 */
async function callOpenRouter(
    messages: ChatMessage[],
    config: AIConfig
): Promise<AIResult> {
    try {
        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: config.model,
                messages: messages,
                temperature: config.temperature ?? 0.2,
                max_tokens: config.maxTokens ?? 2048,
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/voice-coding-assistant',
                    'X-Title': 'Voice Coding Assistant',
                },
                timeout: 60000, // 60 second timeout
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        const usage = response.data?.usage;

        if (!content) {
            throw new Error(
                'OpenRouter returned an empty response.\n' +
                'The AI model may be unavailable. Try a different model.'
            );
        }

        console.log('[AIEngine] Response received:', content.length, 'characters');

        return {
            code: cleanCodeOutput(content),
            model: config.model,
            tokensUsed: usage?.total_tokens,
        };

    } catch (error: any) {
        // Handle specific API error codes
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            switch (status) {
                case 401:
                    throw new Error(
                        '❌ Invalid OpenRouter API key!\n\n' +
                        'Check your .env file and verify OPENROUTER_API_KEY is correct.\n' +
                        'Get your key: https://openrouter.ai/keys'
                    );
                case 402:
                    throw new Error(
                        '❌ Insufficient OpenRouter credits.\n\n' +
                        'Add credits: https://openrouter.ai/credits'
                    );
                case 429:
                    throw new Error(
                        '⏳ Rate limit exceeded.\n\n' +
                        'Wait a moment and try again.'
                    );
                case 503:
                    throw new Error(
                        '🔄 AI model is temporarily unavailable.\n\n' +
                        'Try again in a few seconds, or switch to a different model.'
                    );
                default:
                    throw new Error(
                        `OpenRouter API error (${status}):\n${JSON.stringify(data)}`
                    );
            }
        }

        // Network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error(
                '🌐 Cannot connect to OpenRouter.\n\n' +
                'Check your internet connection.'
            );
        }
        if (error.code === 'ECONNABORTED') {
            throw new Error(
                '⏱️ Request timed out.\n\n' +
                'The AI model took too long. Try again or use a faster model.'
            );
        }

        throw error;
    }
}

// ============================================================================
// Output Cleaning
// ============================================================================

/**
 * Cleans AI output by removing markdown code fences and extra whitespace.
 *
 * AI models sometimes wrap code in ```language ... ``` blocks even when
 * instructed not to. This function strips those wrappers.
 *
 * @param rawOutput - Raw text from the AI model
 * @returns Clean code without markdown formatting
 */
function cleanCodeOutput(rawOutput: string): string {
    let code = rawOutput.trim();

    // Remove ```language ... ``` wrappers
    const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)\n?```$/;
    const match = code.match(codeBlockRegex);
    if (match) {
        code = match[1].trim();
    }

    // Remove leading/trailing backticks that might remain
    code = code.replace(/^`+|`+$/g, '').trim();

    return code;
}
