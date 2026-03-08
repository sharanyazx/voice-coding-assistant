// ============================================================================
// Command Parser Module
// ============================================================================
// Interprets transcribed voice commands and determines what action to perform.
//
// This is the BRAIN of the voice coding assistant. It receives raw text from
// the speech-to-text module and categorizes it into structured commands.
//
// COMMAND CATEGORIES:
//   1. FILE_CREATE      → "create a python file", "create a file called main"
//   2. FILE_OPEN        → "open file utils.py"
//   3. FILE_SAVE        → "save file", "save this"
//   4. FILE_CLOSE       → "close file", "close this"
//   5. FILE_RUN         → "run file", "execute this"
//   6. NAVIGATE         → "go to line 10", "go to top", "go to bottom"
//   7. INSERT_CODE      → "insert function", "create class", "add loop"
//   8. DEBUG            → "debug error in line 15", "explain error"
//   9. FIX_ERROR        → "fix this error", "fix error"
//  10. EDIT_RENAME      → "rename variable x to y"
//  11. FOLDER_CREATE    → "create new folder", "create folder utils"
//  12. PROJECT_CREATE   → "create new project"
//  13. IMPORT_MODULE    → "import module os", "import numpy"
//  14. AI_GENERATE      → anything else → sent to AI for code generation
//
// HOW MATCHING WORKS:
//   We use a priority-ordered list of regex patterns. The first match wins.
//   Patterns are designed to handle natural speech variations:
//   - "create a python file" and "make a python file" both work
//   - "go to line 10" and "navigate to line 10" both work
//   - "run file" and "execute this file" both work
//
// ARCHITECTURE:
//   Transcribed text → Pattern matching → ParsedCommand → (sent to vscodeController)
// ============================================================================

/**
 * All possible command types the assistant can execute.
 */
export enum CommandType {
    /** Create a new file: "create a python file", "create file called main" */
    FILE_CREATE = 'FILE_CREATE',

    /** Open an existing file: "open file utils.py" */
    FILE_OPEN = 'FILE_OPEN',

    /** Save the current file: "save file", "save this" */
    FILE_SAVE = 'FILE_SAVE',

    /** Close the current file: "close file", "close this" */
    FILE_CLOSE = 'FILE_CLOSE',

    /** Run/execute the current file: "run file", "run this" */
    FILE_RUN = 'FILE_RUN',

    /** Navigate cursor: "go to line 10", "go to top" */
    NAVIGATE = 'NAVIGATE',

    /** Insert code snippet: "insert function", "create class", "add loop" */
    INSERT_CODE = 'INSERT_CODE',

    /** Debug a specific line: "debug error in line 15" */
    DEBUG = 'DEBUG',

    /** Fix an error: "fix this error", "fix error" */
    FIX_ERROR = 'FIX_ERROR',

    /** Rename a symbol: "rename variable x to y" */
    EDIT_RENAME = 'EDIT_RENAME',

    /** Create a new folder: "create folder utils" */
    FOLDER_CREATE = 'FOLDER_CREATE',

    /** Create a new project: "create new project" */
    PROJECT_CREATE = 'PROJECT_CREATE',

    /** Import a module: "import os", "import module numpy" */
    IMPORT_MODULE = 'IMPORT_MODULE',

    /** Fallback: send to AI for code generation */
    AI_GENERATE = 'AI_GENERATE',
}

/**
 * A parsed command with its type, parameters, and the original text.
 */
export interface ParsedCommand {
    /** What type of command was detected */
    type: CommandType;

    /** The original transcribed text */
    originalText: string;

    /** Extracted parameters from the command */
    params: CommandParams;
}

/**
 * Parameters extracted from voice commands.
 * Different command types use different params.
 */
export interface CommandParams {
    /** File name (for FILE_CREATE, FILE_OPEN) */
    fileName?: string;

    /** File extension / language (for FILE_CREATE) */
    language?: string;

    /** Line number (for NAVIGATE, DEBUG) */
    lineNumber?: number;

    /** Navigation target: "top", "bottom", or a line number */
    navTarget?: string;

    /** Code description for AI generation (for INSERT_CODE, AI_GENERATE) */
    codeDescription?: string;

    /** Code concept: "function", "class", "loop", "variable", etc. */
    codeConcept?: string;

    /** Old name for renaming */
    oldName?: string;

    /** New name for renaming */
    newName?: string;

    /** Folder name for FOLDER_CREATE */
    folderName?: string;

    /** Module name for IMPORT_MODULE */
    moduleName?: string;
}

// ============================================================================
// Language Extension Mapping
// ============================================================================

/** Maps spoken language names to file extensions */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
    'python': '.py',
    'javascript': '.js',
    'typescript': '.ts',
    'java': '.java',
    'c sharp': '.cs',
    'csharp': '.cs',
    'c#': '.cs',
    'c plus plus': '.cpp',
    'cpp': '.cpp',
    'c++': '.cpp',
    'c': '.c',
    'go': '.go',
    'golang': '.go',
    'rust': '.rs',
    'ruby': '.rb',
    'php': '.php',
    'swift': '.swift',
    'kotlin': '.kt',
    'html': '.html',
    'css': '.css',
    'json': '.json',
    'yaml': '.yaml',
    'yml': '.yaml',
    'xml': '.xml',
    'markdown': '.md',
    'sql': '.sql',
    'shell': '.sh',
    'bash': '.sh',
    'powershell': '.ps1',
    'r': '.r',
    'dart': '.dart',
    'scala': '.scala',
    'lua': '.lua',
    'perl': '.pl',
    'text': '.txt',
};

// ============================================================================
// Command Pattern Definitions
// ============================================================================

/**
 * Each pattern has:
 *   - regex: the pattern to match against transcribed text
 *   - type: the CommandType to assign
 *   - extract: a function to extract parameters from regex match groups
 */
interface CommandPattern {
    regex: RegExp;
    type: CommandType;
    extract: (match: RegExpMatchArray, text: string) => CommandParams;
}

/**
 * Ordered list of command patterns. First match wins.
 * Patterns are case-insensitive.
 */
const COMMAND_PATTERNS: CommandPattern[] = [

    // ====================================================================
    // FILE OPERATIONS
    // ====================================================================

    // "create a python file" / "make a javascript file" / "create a typescript file named app"
    {
        regex: /(?:create|make|new)\s+(?:a\s+)?(\w+)\s+file(?:\s+(?:named?|called)\s+(\w+))?/i,
        type: CommandType.FILE_CREATE,
        extract: (match) => {
            const langOrName = match[1].toLowerCase();
            const explicitName = match[2];

            // Check if the first word is a known language
            if (LANGUAGE_EXTENSIONS[langOrName]) {
                return {
                    language: langOrName,
                    fileName: explicitName || 'main',
                };
            }
            // Otherwise treat it as a file name
            return {
                fileName: langOrName,
                language: 'python', // default
            };
        },
    },

    // "create a file called main" / "create file named calculator"
    {
        regex: /(?:create|make|new)\s+(?:a\s+)?file\s+(?:named?|called)\s+(\w+)(?:\s+(?:in\s+)?(\w+))?/i,
        type: CommandType.FILE_CREATE,
        extract: (match) => {
            const fileName = match[1];
            const lang = match[2]?.toLowerCase();
            return {
                fileName: fileName,
                language: lang && LANGUAGE_EXTENSIONS[lang] ? lang : 'python',
            };
        },
    },

    // "open file utils.py" / "open utils"
    {
        regex: /(?:open)\s+(?:file\s+)?(.+)/i,
        type: CommandType.FILE_OPEN,
        extract: (match) => ({
            fileName: match[1].trim(),
        }),
    },

    // "save file" / "save this" / "save"
    {
        regex: /(?:save)\s*(?:file|this|the file|document)?/i,
        type: CommandType.FILE_SAVE,
        extract: () => ({}),
    },

    // "close file" / "close this" / "close"
    {
        regex: /(?:close)\s*(?:file|this|the file|tab|document)?/i,
        type: CommandType.FILE_CLOSE,
        extract: () => ({}),
    },

    // "run file" / "run this" / "execute file" / "run this file"
    {
        regex: /(?:run|execute)\s*(?:this\s+)?(?:file|program|script|this|code)?/i,
        type: CommandType.FILE_RUN,
        extract: () => ({}),
    },

    // ====================================================================
    // NAVIGATION
    // ====================================================================

    // "go to line 10" / "navigate to line 42" / "move to line 5"
    {
        regex: /(?:go\s+to|navigate\s+to|move\s+to|jump\s+to)\s+line\s+(\d+)/i,
        type: CommandType.NAVIGATE,
        extract: (match) => ({
            lineNumber: parseInt(match[1], 10),
            navTarget: match[1],
        }),
    },

    // "go to top" / "go to top of file" / "go to beginning"
    {
        regex: /(?:go\s+to|navigate\s+to|move\s+to|jump\s+to)\s+(?:the\s+)?(?:top|beginning|start)(?:\s+of\s+(?:the\s+)?file)?/i,
        type: CommandType.NAVIGATE,
        extract: () => ({
            lineNumber: 1,
            navTarget: 'top',
        }),
    },

    // "go to bottom" / "go to end of file" / "go to end"
    {
        regex: /(?:go\s+to|navigate\s+to|move\s+to|jump\s+to)\s+(?:the\s+)?(?:bottom|end)(?:\s+of\s+(?:the\s+)?file)?/i,
        type: CommandType.NAVIGATE,
        extract: () => ({
            lineNumber: -1, // -1 = last line
            navTarget: 'bottom',
        }),
    },

    // ====================================================================
    // CODE INSERTION (sent to AI with context)
    // ====================================================================

    // "insert function to add two numbers" / "insert a function"
    {
        regex: /(?:insert|add|write|create)\s+(?:a\s+)?function\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'function',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "define variable" / "define a variable called x" / "create variable"
    {
        regex: /(?:define|create|declare|add)\s+(?:a\s+)?variable\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'variable',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "create class" / "create a class called Animal"
    {
        regex: /(?:create|define|add|make)\s+(?:a\s+)?class\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'class',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "add constructor" / "create constructor"
    {
        regex: /(?:add|create|insert|write)\s+(?:a\s+)?constructor\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'constructor',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "create loop" / "add for loop" / "add while loop"
    {
        regex: /(?:create|add|insert|write)\s+(?:a\s+)?(?:for\s+|while\s+)?loop\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'loop',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "add if condition" / "create if statement" / "add if else"
    {
        regex: /(?:add|create|insert|write)\s+(?:a\s+|an\s+)?(?:if)\s*(?:condition|statement|else|block)?\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'conditional',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "call function" / "call function add"
    {
        regex: /(?:call)\s+(?:a\s+)?function\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'function_call',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "add error handling" / "add try catch" / "add exception handling"
    {
        regex: /(?:add|create|insert|write)\s+(?:a\s+)?(?:error\s+handling|try\s+catch|exception\s+handling|try\s+except)\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'error_handling',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // ====================================================================
    // IMPORT MODULE
    // ====================================================================

    // "import module os" / "import numpy" / "import os"
    {
        regex: /(?:import)\s+(?:module\s+)?(\w+)/i,
        type: CommandType.IMPORT_MODULE,
        extract: (match) => ({
            moduleName: match[1],
        }),
    },

    // ====================================================================
    // DEBUGGING & ERROR FIXING
    // ====================================================================

    // "debug error in line 15" / "debug line 10"
    {
        regex: /(?:debug|check|analyze)\s+(?:error\s+)?(?:in\s+|on\s+|at\s+)?line\s+(\d+)/i,
        type: CommandType.DEBUG,
        extract: (match) => ({
            lineNumber: parseInt(match[1], 10),
        }),
    },

    // "explain error" / "explain this error" / "what's the error"
    {
        regex: /(?:explain|what(?:'s| is))\s+(?:the\s+|this\s+)?error/i,
        type: CommandType.DEBUG,
        extract: () => ({
            codeDescription: 'explain the error',
        }),
    },

    // "fix this error" / "fix error" / "fix the error" / "fix the bug"
    {
        regex: /(?:fix)\s+(?:this\s+|the\s+)?(?:error|bug|issue|problem)/i,
        type: CommandType.FIX_ERROR,
        extract: () => ({}),
    },

    // ====================================================================
    // RENAME
    // ====================================================================

    // "rename variable x to y" / "rename function old to new"
    {
        regex: /(?:rename)\s+(?:variable|function|class|method)?\s*(\w+)\s+to\s+(\w+)/i,
        type: CommandType.EDIT_RENAME,
        extract: (match) => ({
            oldName: match[1],
            newName: match[2],
        }),
    },

    // ====================================================================
    // FOLDER & PROJECT
    // ====================================================================

    // "create new folder" / "create folder utils" / "make folder components"
    {
        regex: /(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?folder\s*(\w*)/i,
        type: CommandType.FOLDER_CREATE,
        extract: (match) => ({
            folderName: match[1] || undefined,
        }),
    },

    // "create new project" / "start new project"
    {
        regex: /(?:create|make|start)\s+(?:a\s+)?(?:new\s+)?project/i,
        type: CommandType.PROJECT_CREATE,
        extract: () => ({}),
    },
];

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parses transcribed voice text into a structured command.
 *
 * The function tries each pattern in order. The FIRST match wins.
 * If no pattern matches, the command is treated as an AI code generation request.
 *
 * @param text - The transcribed voice text
 * @returns ParsedCommand with type and extracted parameters
 *
 * @example
 *   parseCommand("create a python file")
 *   // → { type: FILE_CREATE, params: { language: "python", fileName: "main" } }
 *
 *   parseCommand("go to line 10")
 *   // → { type: NAVIGATE, params: { lineNumber: 10, navTarget: "10" } }
 *
 *   parseCommand("create a function to sort an array")
 *   // → { type: INSERT_CODE, params: { codeConcept: "function", codeDescription: "to sort an array" } }
 */
export function parseCommand(text: string): ParsedCommand {
    const trimmedText = text.trim();
    console.log('[CommandParser] Parsing:', trimmedText);

    // Try each pattern in order
    for (const pattern of COMMAND_PATTERNS) {
        const match = trimmedText.match(pattern.regex);
        if (match) {
            const params = pattern.extract(match, trimmedText);
            console.log('[CommandParser] Matched:', pattern.type, params);
            return {
                type: pattern.type,
                originalText: trimmedText,
                params,
            };
        }
    }

    // No pattern matched — treat as AI code generation
    console.log('[CommandParser] No pattern matched, falling back to AI_GENERATE');
    return {
        type: CommandType.AI_GENERATE,
        originalText: trimmedText,
        params: {
            codeDescription: trimmedText,
        },
    };
}

/**
 * Gets a human-readable description of a command for display.
 *
 * @param command - The parsed command
 * @returns A friendly string describing what will happen
 */
export function getCommandDescription(command: ParsedCommand): string {
    switch (command.type) {
        case CommandType.FILE_CREATE: {
            const ext = command.params.language
                ? (LANGUAGE_EXTENSIONS[command.params.language] || '.py')
                : '.py';
            const name = command.params.fileName || 'main';
            return `📄 Create file: ${name}${ext}`;
        }
        case CommandType.FILE_OPEN:
            return `📂 Open file: ${command.params.fileName}`;
        case CommandType.FILE_SAVE:
            return `💾 Save current file`;
        case CommandType.FILE_CLOSE:
            return `❌ Close current file`;
        case CommandType.FILE_RUN:
            return `▶️ Run current file`;
        case CommandType.NAVIGATE:
            if (command.params.navTarget === 'top') {
                return `⬆️ Go to top of file`;
            } else if (command.params.navTarget === 'bottom') {
                return `⬇️ Go to bottom of file`;
            } else {
                return `📍 Go to line ${command.params.lineNumber}`;
            }
        case CommandType.INSERT_CODE:
            return `✏️ Insert ${command.params.codeConcept}: ${command.params.codeDescription || ''}`;
        case CommandType.DEBUG:
            return command.params.lineNumber
                ? `🐛 Debug line ${command.params.lineNumber}`
                : `🐛 Explain error`;
        case CommandType.FIX_ERROR:
            return `🔧 Fix error in current code`;
        case CommandType.EDIT_RENAME:
            return `✏️ Rename "${command.params.oldName}" → "${command.params.newName}"`;
        case CommandType.FOLDER_CREATE:
            return `📁 Create folder: ${command.params.folderName || '(ask for name)'}`;
        case CommandType.PROJECT_CREATE:
            return `🚀 Create new project`;
        case CommandType.IMPORT_MODULE:
            return `📦 Import module: ${command.params.moduleName}`;
        case CommandType.AI_GENERATE:
            return `🤖 AI Generate: "${command.originalText}"`;
        default:
            return `❓ Unknown command: "${command.originalText}"`;
    }
}

/**
 * Gets the file extension for a language name.
 * Returns .py (Python) if the language is not recognized.
 */
export function getLanguageExtension(language: string): string {
    return LANGUAGE_EXTENSIONS[language.toLowerCase()] || '.py';
}
