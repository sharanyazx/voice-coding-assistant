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

    /** Delete a file: "delete file main.py" */
    FILE_DELETE = 'FILE_DELETE',

    /** Stop a running program: "stop program" */
    STOP_PROGRAM = 'STOP_PROGRAM',

    /** Open terminal: "open terminal" */
    OPEN_TERMINAL = 'OPEN_TERMINAL',

    /** Navigate to next/previous function: "next function" */
    NAVIGATE_FUNCTION = 'NAVIGATE_FUNCTION',

    /** Find/search for a symbol: "find variable count" */
    FIND_SYMBOL = 'FIND_SYMBOL',

    /** Save all files: "save all files" */
    SAVE_ALL = 'SAVE_ALL',

    /** Reopen last closed file: "reopen file" */
    REOPEN_FILE = 'REOPEN_FILE',

    /** Switch to another tab: "switch file" */
    SWITCH_FILE = 'SWITCH_FILE',

    /** Undo last action: "undo" */
    UNDO = 'UNDO',

    /** Redo last action: "redo" */
    REDO = 'REDO',

    /** Select all text: "select all" */
    SELECT_ALL = 'SELECT_ALL',

    /** Copy selection: "copy" */
    COPY = 'COPY',

    /** Paste: "paste" */
    PASTE = 'PASTE',

    /** Show help: "help", "show commands" */
    SHOW_HELP = 'SHOW_HELP',

    /** Delete line(s): "delete line", "delete line 5", "remove line" */
    DELETE_LINE = 'DELETE_LINE',

    /** Cut line: "cut line" */
    CUT_LINE = 'CUT_LINE',

    /** Duplicate line: "duplicate line", "copy line down" */
    DUPLICATE_LINE = 'DUPLICATE_LINE',

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

    /** Search term for FIND_SYMBOL */
    searchTerm?: string;

    /** Direction for NAVIGATE_FUNCTION: "next" or "previous" */
    direction?: 'next' | 'previous';

    /** End line number for range operations (e.g., DELETE_LINE range) */
    endLineNumber?: number;
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
// Spoken Number → Digit Conversion
// ============================================================================

/** Maps spoken number words to numeric values */
const WORD_NUMBERS: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
    'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100,
    // Common Whisper mis-transcriptions
    'to': 2, 'too': 2, 'for': 4, 'fore': 4, 'won': 1,
    'ate': 8, 'tree': 3,
    // Indian accent Whisper variations
    'wan': 1, 'tow': 2, 'fife': 5, 'siks': 6,
    'ait': 8, 'nain': 9, 'tin': 10, 'twinty': 20,
    'thurty': 30, 'farty': 40, 'fifti': 50,
};

/**
 * Converts a spoken number (word or digit) to a numeric value.
 *
 * Handles:
 *   - Digits: "10" → 10
 *   - Simple words: "two" → 2, "fifteen" → 15
 *   - Compound: "twenty five" → 25, "thirty two" → 32
 *   - With hyphens: "twenty-five" → 25
 *
 * @param text - The spoken number string
 * @returns The numeric value, or NaN if not recognized
 */
function parseSpokenNumber(text: string): number {
    const cleaned = text.trim().toLowerCase();

    // If it's already a digit string, parse directly
    if (/^\d+$/.test(cleaned)) {
        return parseInt(cleaned, 10);
    }

    // Split on spaces or hyphens: "twenty five" → ["twenty", "five"]
    const parts = cleaned.split(/[\s-]+/);

    // Single word
    if (parts.length === 1) {
        return WORD_NUMBERS[parts[0]] ?? NaN;
    }

    // Two words: e.g. "twenty five" → 20 + 5 = 25
    if (parts.length === 2) {
        const first = WORD_NUMBERS[parts[0]];
        const second = WORD_NUMBERS[parts[1]];
        if (first !== undefined && second !== undefined) {
            // Handle "one hundred" → 100
            if (parts[1] === 'hundred') { return first * 100; }
            return first + second;
        }
        // Maybe only the second part is a number
        if (second !== undefined) { return second; }
        if (first !== undefined) { return first; }
    }

    // Three words: e.g. "one hundred five" → 105
    if (parts.length === 3) {
        const first = WORD_NUMBERS[parts[0]];
        const third = WORD_NUMBERS[parts[2]];
        if (first !== undefined && parts[1] === 'hundred' && third !== undefined) {
            return first * 100 + third;
        }
    }

    return NaN;
}

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
    // HELP (must be very early — simple keywords that'd be eaten by others)
    // ====================================================================

    // "help" / "show commands" / "what can I say" / "list commands"
    {
        regex: /(?:^help$|show\s+commands|what\s+can\s+I\s+say|list\s+commands|voice\s+command\s+help)/i,
        type: CommandType.SHOW_HELP,
        extract: () => ({}),
    },

    // ====================================================================
    // UNDO / REDO (must be before FILE_CLOSE so "undo close" works)
    // ====================================================================

    // "undo close" → REOPEN_FILE (must be before bare "undo")
    {
        regex: /(?:undo)\s+close/i,
        type: CommandType.REOPEN_FILE,
        extract: () => ({}),
    },

    // "undo" / "undo that" / "undo last"
    {
        regex: /^(?:undo)\s*(?:that|this|last)?$/i,
        type: CommandType.UNDO,
        extract: () => ({}),
    },

    // "redo" / "redo that" / "redo last"
    {
        regex: /^(?:redo)\s*(?:that|this|last)?$/i,
        type: CommandType.REDO,
        extract: () => ({}),
    },

    // ====================================================================
    // LINE EDITING (must be before FILE_DELETE so "delete line" works)
    // ====================================================================

    // "delete line" / "delete line 5" / "remove line 5" / "delete lines 5 to 10"
    // Also handles spoken numbers: "delete line five"
    {
        regex: /(?:delete|remove|erase)\s+lines?(?:\s+(\d+|\w+))?\s*(?:to|through|-)?\s*(\d+|\w+)?/i,
        type: CommandType.DELETE_LINE,
        extract: (match) => {
            let lineNum: number | undefined;
            let endNum: number | undefined;
            if (match[1]) {
                const n = parseSpokenNumber(match[1]);
                lineNum = isNaN(n) ? undefined : n;
            }
            if (match[2]) {
                const n = parseSpokenNumber(match[2]);
                endNum = isNaN(n) ? undefined : n;
            }
            return {
                lineNumber: lineNum,
                endLineNumber: endNum,
            };
        },
    },

    // "cut line" / "cut this line"
    {
        regex: /(?:cut)\s+(?:this\s+)?line/i,
        type: CommandType.CUT_LINE,
        extract: () => ({}),
    },

    // "duplicate line" / "copy line down" / "duplicate this line"
    {
        regex: /(?:duplicate|clone|copy)\s+(?:this\s+)?line(?:\s+down)?/i,
        type: CommandType.DUPLICATE_LINE,
        extract: () => ({}),
    },

    // ====================================================================
    // STOP PROGRAM (must be before FILE_RUN so "stop running" works)
    // ====================================================================

    // "stop program" / "stop running" / "kill process" / "stop execution"
    {
        regex: /(?:stop|kill|terminate|end)\s+(?:the\s+)?(?:program|process|running|execution|script)/i,
        type: CommandType.STOP_PROGRAM,
        extract: () => ({}),
    },

    // ====================================================================
    // REOPEN FILE (must be before FILE_OPEN so "reopen" doesn't match "open")
    // ====================================================================

    // "reopen file" / "reopen last file"
    {
        regex: /(?:reopen|re-open)\s+(?:last\s+)?(?:file|tab)/i,
        type: CommandType.REOPEN_FILE,
        extract: () => ({}),
    },

    // ====================================================================
    // OPEN TERMINAL (must be before FILE_OPEN so "open terminal" works)
    // ====================================================================

    // "open terminal" / "show terminal" / "new terminal"
    {
        regex: /(?:open|show|new|launch)\s+(?:a\s+)?(?:the\s+)?terminal/i,
        type: CommandType.OPEN_TERMINAL,
        extract: () => ({}),
    },

    // ====================================================================
    // SAVE ALL (must be before FILE_SAVE so "save all" works)
    // ====================================================================

    // "save all files" / "save all" / "save everything"
    {
        regex: /(?:save)\s+(?:all)\s*(?:files|documents)?/i,
        type: CommandType.SAVE_ALL,
        extract: () => ({}),
    },

    // ====================================================================
    // FILE OPERATIONS
    // ====================================================================

    // "create a c plus plus file" / "create a c sharp file" (multi-word languages)
    {
        regex: /(?:create|make|new)\s+(?:a\s+)?(c\s+plus\s+plus|c\s+sharp)\s+file(?:\s+(?:named?|called)\s+(\w+))?/i,
        type: CommandType.FILE_CREATE,
        extract: (match) => {
            const langRaw = match[1].toLowerCase().replace(/\s+/g, ' ');
            const explicitName = match[2];
            return {
                language: langRaw,
                fileName: explicitName || 'main',
            };
        },
    },

    // "create a python file" / "make a javascript file" / "create a typescript file named app"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:(?:can|could)\s+(?:you\s+))?(?:create|make|new)\s+(?:a\s+)?(\w+)\s+file(?:\s+(?:named?|called)\s+(\w+))?/i,
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
        regex: /(?:(?:please|kindly)\s+)?(?:(?:can|could)\s+(?:you\s+))?(?:create|make|new)\s+(?:a\s+)?file\s+(?:named?|called)\s+(\w+)(?:\s+(?:in\s+)?(\w+))?/i,
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

    // "open file utils.py" / "open utils" (but NOT "open terminal")
    {
        regex: /(?:(?:please|kindly)\s+)?(?:open)\s+(?:file\s+)?(.+)/i,
        type: CommandType.FILE_OPEN,
        extract: (match) => ({
            fileName: match[1].trim(),
        }),
    },

    // "save file" / "save this" / "save"
    {
        regex: /(?:(?:please|kindly|do)\s+)?(?:save)\s*(?:file|this|the\s+file|document)?[.!]?$/i,
        type: CommandType.FILE_SAVE,
        extract: () => ({}),
    },

    // "close file" / "close this" / "close"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:close)\s*(?:file|this|the\s+file|tab|document)?[.!]?$/i,
        type: CommandType.FILE_CLOSE,
        extract: () => ({}),
    },

    // "run file" / "run this" / "execute file" / "run this file"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:run|execute)\s*(?:this\s+)?(?:file|program|script|this|code)?[.!]?$/i,
        type: CommandType.FILE_RUN,
        extract: () => ({}),
    },

    // ====================================================================
    // NAVIGATION
    // ====================================================================

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

    // "go to line 10" / "navigate to line 42" / "move to line two"
    {
        regex: /(?:go\s+to|navigate\s+to|move\s+to|jump\s+to)\s+line\s+(.+)/i,
        type: CommandType.NAVIGATE,
        extract: (match) => {
            const num = parseSpokenNumber(match[1].replace(/[.!,]+$/, ''));
            return {
                lineNumber: isNaN(num) ? 1 : num,
                navTarget: String(isNaN(num) ? 1 : num),
            };
        },
    },

    // "line 5" / "line two" / "line twenty five" (shorthand without "go to")
    {
        regex: /^line\s+(.+)$/i,
        type: CommandType.NAVIGATE,
        extract: (match) => {
            const num = parseSpokenNumber(match[1].replace(/[.!,]+$/, ''));
            return {
                lineNumber: isNaN(num) ? 1 : num,
                navTarget: String(isNaN(num) ? 1 : num),
            };
        },
    },

    // ====================================================================
    // CODE INSERTION (sent to AI with context)
    // ====================================================================

    // "insert function to add two numbers" / "insert a function"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:insert|add|write|create)\s+(?:a\s+)?function\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'function',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "define variable" / "define a variable called x" / "create variable"
    // Also handles Indian accent: "wariable" / "wariabul"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:define|create|declare|add)\s+(?:a\s+)?(?:variable|wariable|wariabul)\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'variable',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "create class" / "create a class called Animal"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:create|define|add|make)\s+(?:a\s+)?class\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'class',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "add constructor" / "create constructor"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:add|create|insert|write)\s+(?:a\s+)?constructor\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'constructor',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "create loop" / "add for loop" / "add while loop"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:create|add|insert|write)\s+(?:a\s+)?(?:for\s+|while\s+)?loop\s*(.*)/i,
        type: CommandType.INSERT_CODE,
        extract: (match, text) => ({
            codeConcept: 'loop',
            codeDescription: match[1]?.trim() || text,
        }),
    },

    // "add if condition" / "create if statement" / "add if else"
    {
        regex: /(?:(?:please|kindly)\s+)?(?:add|create|insert|write)\s+(?:a\s+|an\s+)?(?:if)\s*(?:condition|statement|else|block)?\s*(.*)/i,
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
        regex: /(?:(?:please|kindly)\s+)?(?:add|create|insert|write)\s+(?:a\s+)?(?:error\s+handling|try\s+catch|exception\s+handling|try\s+except)\s*(.*)/i,
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

    // "debug error in line 15" / "debug line ten" / "debug line 10"
    {
        regex: /(?:debug|check|analyze)\s+(?:error\s+)?(?:in\s+|on\s+|at\s+)?line\s+(.+)/i,
        type: CommandType.DEBUG,
        extract: (match) => {
            const num = parseSpokenNumber(match[1].replace(/[.!,]+$/, ''));
            return {
                lineNumber: isNaN(num) ? 1 : num,
            };
        },
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

    // ====================================================================
    // DELETE FILE (now after DELETE_LINE, so "delete line" is safe)
    // ====================================================================

    // "delete file main.py" / "remove file utils" / "delete main.py"
    {
        regex: /(?:delete|remove)\s+(?:file\s+)?(.+)/i,
        type: CommandType.FILE_DELETE,
        extract: (match) => ({
            fileName: match[1].trim(),
        }),
    },

    // ====================================================================
    // ADVANCED NAVIGATION
    // ====================================================================

    // "next function" / "go to next function"
    {
        regex: /(?:next|go\s+to\s+next)\s+function/i,
        type: CommandType.NAVIGATE_FUNCTION,
        extract: () => ({
            direction: 'next' as const,
        }),
    },

    // "previous function" / "go to previous function"
    {
        regex: /(?:previous|prev|go\s+to\s+previous|go\s+to\s+prev|last)\s+function/i,
        type: CommandType.NAVIGATE_FUNCTION,
        extract: () => ({
            direction: 'previous' as const,
        }),
    },

    // "find variable count" / "find function add" / "search for class"
    {
        regex: /(?:find|search|search\s+for|locate)\s+(?:variable|function|class|method|symbol)?\s*(\w+)/i,
        type: CommandType.FIND_SYMBOL,
        extract: (match) => ({
            searchTerm: match[1],
        }),
    },

    // ====================================================================
    // ADDITIONAL EDITOR COMMANDS
    // ====================================================================

    // "switch file" / "switch tab" / "next tab" / "next file"
    {
        regex: /(?:switch|next|previous|prev)\s+(?:file|tab)/i,
        type: CommandType.SWITCH_FILE,
        extract: () => ({}),
    },

    // "select all" / "select everything"
    {
        regex: /(?:select)\s+(?:all|everything)/i,
        type: CommandType.SELECT_ALL,
        extract: () => ({}),
    },

    // "copy" / "copy this" / "copy selection"
    {
        regex: /^(?:copy)\s*(?:this|selection|text)?$/i,
        type: CommandType.COPY,
        extract: () => ({}),
    },

    // "paste" / "paste here" / "paste text"
    {
        regex: /^(?:paste)\s*(?:here|text|this)?$/i,
        type: CommandType.PASTE,
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
        case CommandType.FILE_DELETE:
            return `🗑️ Delete file: ${command.params.fileName}`;
        case CommandType.STOP_PROGRAM:
            return `⏹️ Stop running program`;
        case CommandType.OPEN_TERMINAL:
            return `💻 Open terminal`;
        case CommandType.NAVIGATE_FUNCTION:
            return `${command.params.direction === 'next' ? '⏭️' : '⏮️'} Go to ${command.params.direction} function`;
        case CommandType.FIND_SYMBOL:
            return `🔍 Find: "${command.params.searchTerm}"`;
        case CommandType.SAVE_ALL:
            return `💾 Save all files`;
        case CommandType.REOPEN_FILE:
            return `📂 Reopen last closed file`;
        case CommandType.SWITCH_FILE:
            return `🔄 Switch file/tab`;
        case CommandType.UNDO:
            return `↩️ Undo`;
        case CommandType.REDO:
            return `↪️ Redo`;
        case CommandType.SELECT_ALL:
            return `📋 Select all`;
        case CommandType.COPY:
            return `📄 Copy`;
        case CommandType.PASTE:
            return `📋 Paste`;
        case CommandType.SHOW_HELP:
            return `❓ Show voice commands help`;
        case CommandType.DELETE_LINE:
            if (command.params.lineNumber && command.params.endLineNumber) {
                return `🗑️ Delete lines ${command.params.lineNumber} to ${command.params.endLineNumber}`;
            } else if (command.params.lineNumber) {
                return `🗑️ Delete line ${command.params.lineNumber}`;
            }
            return `🗑️ Delete current line`;
        case CommandType.CUT_LINE:
            return `✂️ Cut current line`;
        case CommandType.DUPLICATE_LINE:
            return `📋 Duplicate current line`;
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
