// ============================================================================
// Command Dictionary Module
// ============================================================================
// A comprehensive reference of all supported voice commands organized by
// category. This module serves two purposes:
//
//   1. DOCUMENTATION — Provides a searchable dictionary of all commands
//      that users can say to the assistant.
//
//   2. HELP SYSTEM — Powers the "voice command help" feature, allowing
//      users to ask what commands are available.
//
// TOTAL COMMANDS: 120+
//
// CATEGORIES:
//   1. File Operations          (15 commands)
//   2. Code Navigation          (15 commands)
//   3. Code Generation          (20 commands)
//   4. Debugging & Error Fixing (10 commands)
//   5. Program Execution        (10 commands)
//   6. Editor Control           (10 commands)
//   7. Project Management       (10 commands)
//   8. Variable & Symbol Ops    (10 commands)
//   9. Voice Control            (10 commands)
//  10. Search & Find            (10 commands)
//
// ARCHITECTURE:
//   This module exports the dictionary and helper functions.
//   commandParser.ts handles the actual regex matching.
//   This module is for reference, help, and validation.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/**
 * A single voice command entry in the dictionary.
 */
export interface VoiceCommand {
    /** The voice command phrase (what the user says) */
    phrase: string;

    /** What this command does */
    description: string;

    /** The internal action category */
    action: string;

    /** Example of what happens */
    example?: string;

    /** Alternative ways to say the same thing */
    aliases?: string[];

    /** Whether this is a priority/common command */
    isPrimary?: boolean;
}

/**
 * A category of voice commands.
 */
export interface CommandCategory {
    /** Category name */
    name: string;

    /** Category description */
    description: string;

    /** Icon for display */
    icon: string;

    /** Commands in this category */
    commands: VoiceCommand[];
}

// ============================================================================
// Complete Command Dictionary
// ============================================================================

export const COMMAND_DICTIONARY: CommandCategory[] = [

    // ========================================================================
    // 1. FILE OPERATIONS
    // ========================================================================
    {
        name: 'File Operations',
        description: 'Create, open, save, close, rename, and delete files.',
        icon: '📄',
        commands: [
            {
                phrase: 'create python file',
                description: 'Creates a new Python (.py) file',
                action: 'FILE_CREATE',
                example: 'Creates main.py and opens it',
                aliases: ['make python file', 'new python file'],
                isPrimary: true,
            },
            {
                phrase: 'create java file',
                description: 'Creates a new Java (.java) file',
                action: 'FILE_CREATE',
                example: 'Creates Main.java and opens it',
                aliases: ['make java file', 'new java file'],
                isPrimary: true,
            },
            {
                phrase: 'create javascript file',
                description: 'Creates a new JavaScript (.js) file',
                action: 'FILE_CREATE',
                aliases: ['make javascript file', 'new js file'],
            },
            {
                phrase: 'create typescript file',
                description: 'Creates a new TypeScript (.ts) file',
                action: 'FILE_CREATE',
                aliases: ['make typescript file', 'new ts file'],
            },
            {
                phrase: 'create c plus plus file',
                description: 'Creates a new C++ (.cpp) file',
                action: 'FILE_CREATE',
                aliases: ['make cpp file', 'new cpp file'],
            },
            {
                phrase: 'create c file',
                description: 'Creates a new C (.c) file',
                action: 'FILE_CREATE',
                aliases: ['make c file', 'new c file'],
            },
            {
                phrase: 'create file named calculator',
                description: 'Creates a file with the specified name',
                action: 'FILE_CREATE',
                example: 'Creates calculator.py (defaults to Python)',
                aliases: ['create file called calculator', 'make file named calculator'],
                isPrimary: true,
            },
            {
                phrase: 'create python file named calculator',
                description: 'Creates a Python file with a specific name',
                action: 'FILE_CREATE',
                example: 'Creates calculator.py',
                aliases: ['make python file called calculator'],
                isPrimary: true,
            },
            {
                phrase: 'create java file named Calculator',
                description: 'Creates a Java file with a specific name',
                action: 'FILE_CREATE',
                example: 'Creates Calculator.java',
                aliases: ['make java file called Calculator'],
                isPrimary: true,
            },
            {
                phrase: 'open file main',
                description: 'Opens a file matching the name "main"',
                action: 'FILE_OPEN',
                example: 'Searches workspace and opens main.py or similar',
                aliases: ['open main', 'open file main.py'],
                isPrimary: true,
            },
            {
                phrase: 'rename file test to app',
                description: 'Renames the file "test" to "app"',
                action: 'EDIT_RENAME',
                aliases: ['rename test to app'],
            },
            {
                phrase: 'delete file temp',
                description: 'Deletes the file named "temp" (with confirmation)',
                action: 'FILE_DELETE',
                example: 'Asks for confirmation before deleting',
                aliases: ['remove file temp'],
                isPrimary: true,
            },
            {
                phrase: 'save file',
                description: 'Saves the currently active file',
                action: 'FILE_SAVE',
                aliases: ['save this', 'save', 'save document'],
                isPrimary: true,
            },
            {
                phrase: 'save all files',
                description: 'Saves all open files',
                action: 'FILE_SAVE_ALL',
                aliases: ['save all', 'save everything'],
            },
            {
                phrase: 'close file',
                description: 'Closes the currently active tab',
                action: 'FILE_CLOSE',
                aliases: ['close this', 'close tab', 'close document'],
                isPrimary: true,
            },
        ],
    },

    // ========================================================================
    // 2. CODE NAVIGATION
    // ========================================================================
    {
        name: 'Code Navigation',
        description: 'Move the cursor to specific locations in your code.',
        icon: '🧭',
        commands: [
            {
                phrase: 'go to line 10',
                description: 'Moves cursor to line 10',
                action: 'NAVIGATE',
                aliases: ['navigate to line 10', 'jump to line 10', 'move to line 10'],
                isPrimary: true,
            },
            {
                phrase: 'go to line twenty five',
                description: 'Moves cursor to line 25 (supports spoken numbers)',
                action: 'NAVIGATE',
                aliases: ['go to line twenty-five'],
            },
            {
                phrase: 'line 5',
                description: 'Shorthand: moves cursor to line 5',
                action: 'NAVIGATE',
                aliases: ['line five'],
            },
            {
                phrase: 'go to top of file',
                description: 'Moves cursor to the first line',
                action: 'NAVIGATE',
                aliases: ['go to top', 'go to beginning', 'go to start'],
                isPrimary: true,
            },
            {
                phrase: 'go to bottom of file',
                description: 'Moves cursor to the last line',
                action: 'NAVIGATE',
                aliases: ['go to bottom', 'go to end', 'go to end of file'],
                isPrimary: true,
            },
            {
                phrase: 'next function',
                description: 'Jumps to the next function definition',
                action: 'NAVIGATE_FUNCTION',
                aliases: ['go to next function'],
                isPrimary: true,
            },
            {
                phrase: 'previous function',
                description: 'Jumps to the previous function definition',
                action: 'NAVIGATE_FUNCTION',
                aliases: ['go to previous function', 'prev function', 'last function'],
                isPrimary: true,
            },
            {
                phrase: 'find variable count',
                description: 'Searches for "count" in the current file',
                action: 'FIND_SYMBOL',
                aliases: ['search for count', 'locate count', 'find count'],
                isPrimary: true,
            },
            {
                phrase: 'find function add',
                description: 'Searches for the function "add" in the file',
                action: 'FIND_SYMBOL',
                aliases: ['search for function add', 'locate function add'],
            },
            {
                phrase: 'find class Animal',
                description: 'Searches for the class "Animal" in the file',
                action: 'FIND_SYMBOL',
                aliases: ['search for class Animal', 'locate class Animal'],
            },
            {
                phrase: 'go to line 1',
                description: 'Moves cursor to the very first line',
                action: 'NAVIGATE',
            },
            {
                phrase: 'go to line 100',
                description: 'Moves cursor to line 100',
                action: 'NAVIGATE',
            },
            {
                phrase: 'go to line fifty',
                description: 'Moves cursor to line 50',
                action: 'NAVIGATE',
            },
            {
                phrase: 'navigate to line 42',
                description: 'Moves cursor to line 42',
                action: 'NAVIGATE',
            },
            {
                phrase: 'jump to line 7',
                description: 'Moves cursor to line 7',
                action: 'NAVIGATE',
            },
        ],
    },

    // ========================================================================
    // 3. CODE GENERATION
    // ========================================================================
    {
        name: 'Code Generation',
        description: 'Generate code constructs using AI.',
        icon: '✏️',
        commands: [
            {
                phrase: 'create function add numbers',
                description: 'Generates a function to add numbers in current language',
                action: 'INSERT_CODE',
                example: 'Python: def add_numbers(a, b): ... | Java: public int addNumbers(int a, int b) { ... }',
                aliases: ['insert function add numbers', 'write function add numbers'],
                isPrimary: true,
            },
            {
                phrase: 'create function',
                description: 'Generates an empty function definition',
                action: 'INSERT_CODE',
                aliases: ['insert function', 'add function', 'write function'],
                isPrimary: true,
            },
            {
                phrase: 'define variable',
                description: 'Creates a variable declaration',
                action: 'INSERT_CODE',
                aliases: ['create variable', 'declare variable', 'add variable'],
                isPrimary: true,
            },
            {
                phrase: 'define variable count equal to zero',
                description: 'Creates a specific variable with initial value',
                action: 'INSERT_CODE',
                example: 'Python: count = 0 | Java: int count = 0;',
            },
            {
                phrase: 'create class Animal',
                description: 'Generates a class named Animal',
                action: 'INSERT_CODE',
                example: 'Python: class Animal: ... | Java: public class Animal { ... }',
                aliases: ['define class Animal', 'add class Animal'],
                isPrimary: true,
            },
            {
                phrase: 'add constructor',
                description: 'Generates a constructor for the current class',
                action: 'INSERT_CODE',
                aliases: ['create constructor', 'insert constructor', 'write constructor'],
                isPrimary: true,
            },
            {
                phrase: 'add constructor with name and age',
                description: 'Generates a constructor with specific parameters',
                action: 'INSERT_CODE',
                example: 'Python: def __init__(self, name, age): ...',
            },
            {
                phrase: 'create loop',
                description: 'Generates a loop structure',
                action: 'INSERT_CODE',
                aliases: ['add loop', 'insert loop', 'write loop'],
                isPrimary: true,
            },
            {
                phrase: 'add for loop',
                description: 'Generates a for loop',
                action: 'INSERT_CODE',
                aliases: ['create for loop', 'insert for loop'],
            },
            {
                phrase: 'add while loop',
                description: 'Generates a while loop',
                action: 'INSERT_CODE',
                aliases: ['create while loop', 'insert while loop'],
            },
            {
                phrase: 'add if condition',
                description: 'Generates an if-else block',
                action: 'INSERT_CODE',
                aliases: ['create if statement', 'add if else', 'write if condition'],
                isPrimary: true,
            },
            {
                phrase: 'add if condition to check if number is positive',
                description: 'Generates a specific conditional check',
                action: 'INSERT_CODE',
                example: 'if number > 0: ...',
            },
            {
                phrase: 'call function add',
                description: 'Inserts a function call',
                action: 'INSERT_CODE',
                aliases: ['call add function'],
            },
            {
                phrase: 'add error handling',
                description: 'Generates try-catch/except block',
                action: 'INSERT_CODE',
                aliases: ['add try catch', 'add exception handling', 'add try except'],
                isPrimary: true,
            },
            {
                phrase: 'create function to sort an array',
                description: 'AI generates a complete sorting function',
                action: 'INSERT_CODE',
                isPrimary: true,
            },
            {
                phrase: 'create function to read a file',
                description: 'AI generates file reading function',
                action: 'INSERT_CODE',
            },
            {
                phrase: 'create function to connect to database',
                description: 'AI generates database connection function',
                action: 'INSERT_CODE',
            },
            {
                phrase: 'write a binary search function',
                description: 'AI generates binary search implementation',
                action: 'INSERT_CODE',
            },
            {
                phrase: 'create a linked list class',
                description: 'AI generates a complete linked list implementation',
                action: 'INSERT_CODE',
            },
            {
                phrase: 'add getter and setter methods',
                description: 'AI generates accessor methods for class fields',
                action: 'INSERT_CODE',
            },
        ],
    },

    // ========================================================================
    // 4. DEBUGGING & ERROR FIXING
    // ========================================================================
    {
        name: 'Debugging & Error Fixing',
        description: 'Analyze, debug, and fix errors in your code using AI.',
        icon: '🐛',
        commands: [
            {
                phrase: 'debug error in line 12',
                description: 'Analyzes code at line 12 for errors',
                action: 'DEBUG',
                aliases: ['check error in line 12', 'analyze line 12'],
                isPrimary: true,
            },
            {
                phrase: 'debug line 5',
                description: 'Analyzes code around line 5',
                action: 'DEBUG',
                aliases: ['check line 5'],
            },
            {
                phrase: 'explain this error',
                description: 'AI explains the error in the current code',
                action: 'DEBUG',
                aliases: ['explain error', 'what is the error', 'what is this error'],
                isPrimary: true,
            },
            {
                phrase: 'fix this error',
                description: 'AI fixes the error and replaces the code',
                action: 'FIX_ERROR',
                aliases: ['fix error', 'fix the error', 'fix the bug', 'fix this bug'],
                isPrimary: true,
            },
            {
                phrase: 'why is this code failing',
                description: 'AI explains why the code is not working',
                action: 'DEBUG',
                aliases: ['why is this failing', 'why does this fail'],
            },
            {
                phrase: 'debug error in line fifteen',
                description: 'Supports spoken numbers for line references',
                action: 'DEBUG',
            },
            {
                phrase: 'analyze error',
                description: 'General error analysis of the entire file',
                action: 'DEBUG',
                aliases: ['check for errors', 'find bugs'],
            },
            {
                phrase: 'fix the issue',
                description: 'Synonym for fix error',
                action: 'FIX_ERROR',
                aliases: ['fix the problem', 'fix the issue'],
            },
            {
                phrase: 'debug line twenty',
                description: 'Debug at spoken number line',
                action: 'DEBUG',
            },
            {
                phrase: 'explain error in line 30',
                description: 'Explains the error at a specific line',
                action: 'DEBUG',
            },
        ],
    },

    // ========================================================================
    // 5. PROGRAM EXECUTION
    // ========================================================================
    {
        name: 'Program Execution',
        description: 'Run, stop, and manage program execution.',
        icon: '▶️',
        commands: [
            {
                phrase: 'run file',
                description: 'Runs the currently open file',
                action: 'FILE_RUN',
                example: '.py → python file.py | .java → javac + java',
                aliases: ['run this', 'run program', 'execute file', 'run this file'],
                isPrimary: true,
            },
            {
                phrase: 'run python program',
                description: 'Runs the file using Python interpreter',
                action: 'FILE_RUN',
                aliases: ['execute python file'],
                isPrimary: true,
            },
            {
                phrase: 'run java program',
                description: 'Compiles and runs the Java file',
                action: 'FILE_RUN',
                aliases: ['execute java file'],
                isPrimary: true,
            },
            {
                phrase: 'run code',
                description: 'Executes the current file',
                action: 'FILE_RUN',
                aliases: ['execute code', 'run script'],
            },
            {
                phrase: 'stop execution',
                description: 'Stops all running terminals',
                action: 'STOP_PROGRAM',
                aliases: ['stop program', 'stop running', 'kill process', 'terminate program'],
                isPrimary: true,
            },
            {
                phrase: 'open terminal',
                description: 'Opens a new integrated terminal',
                action: 'OPEN_TERMINAL',
                aliases: ['show terminal', 'new terminal', 'launch terminal'],
                isPrimary: true,
            },
            {
                phrase: 'stop program',
                description: 'Kills all running terminal processes',
                action: 'STOP_PROGRAM',
                aliases: ['end program', 'kill program'],
            },
            {
                phrase: 'run',
                description: 'Shorthand for running the current file',
                action: 'FILE_RUN',
            },
            {
                phrase: 'execute this',
                description: 'Runs the current file in terminal',
                action: 'FILE_RUN',
            },
            {
                phrase: 'run this script',
                description: 'Runs the active script file',
                action: 'FILE_RUN',
            },
        ],
    },

    // ========================================================================
    // 6. EDITOR CONTROL
    // ========================================================================
    {
        name: 'Editor Control',
        description: 'Control the VS Code editor using voice.',
        icon: '🖥️',
        commands: [
            {
                phrase: 'save file',
                description: 'Saves the active file',
                action: 'FILE_SAVE',
                aliases: ['save this', 'save'],
                isPrimary: true,
            },
            {
                phrase: 'save all files',
                description: 'Saves all modified files',
                action: 'FILE_SAVE_ALL',
                aliases: ['save all', 'save everything'],
            },
            {
                phrase: 'close file',
                description: 'Closes the active editor tab',
                action: 'FILE_CLOSE',
                aliases: ['close this', 'close tab'],
                isPrimary: true,
            },
            {
                phrase: 'reopen file',
                description: 'Reopens the last closed file',
                action: 'REOPEN_FILE',
                aliases: ['reopen last file', 'undo close'],
            },
            {
                phrase: 'switch file',
                description: 'Switches to another open file',
                action: 'SWITCH_FILE',
                aliases: ['switch tab', 'next tab', 'next file'],
            },
            {
                phrase: 'undo',
                description: 'Undoes the last action',
                action: 'UNDO',
                aliases: ['undo that', 'undo last'],
            },
            {
                phrase: 'redo',
                description: 'Redoes the last undone action',
                action: 'REDO',
                aliases: ['redo that', 'redo last'],
            },
            {
                phrase: 'select all',
                description: 'Selects all text in the file',
                action: 'SELECT_ALL',
                aliases: ['select everything'],
            },
            {
                phrase: 'copy selection',
                description: 'Copies the selected text',
                action: 'COPY',
                aliases: ['copy this', 'copy'],
            },
            {
                phrase: 'paste',
                description: 'Pastes from clipboard',
                action: 'PASTE',
                aliases: ['paste here', 'paste text'],
            },
        ],
    },

    // ========================================================================
    // 7. PROJECT MANAGEMENT
    // ========================================================================
    {
        name: 'Project Management',
        description: 'Manage folders, projects, and modules.',
        icon: '📁',
        commands: [
            {
                phrase: 'create new project',
                description: 'Creates a new project folder',
                action: 'PROJECT_CREATE',
                aliases: ['start new project', 'make new project'],
                isPrimary: true,
            },
            {
                phrase: 'create folder utils',
                description: 'Creates a folder named "utils"',
                action: 'FOLDER_CREATE',
                aliases: ['make folder utils', 'new folder utils'],
                isPrimary: true,
            },
            {
                phrase: 'create folder',
                description: 'Creates a new folder (prompts for name)',
                action: 'FOLDER_CREATE',
                aliases: ['make folder', 'new folder'],
            },
            {
                phrase: 'create folder components',
                description: 'Creates a "components" folder',
                action: 'FOLDER_CREATE',
            },
            {
                phrase: 'create folder models',
                description: 'Creates a "models" folder',
                action: 'FOLDER_CREATE',
            },
            {
                phrase: 'add module',
                description: 'Creates a new module file',
                action: 'FILE_CREATE',
                aliases: ['create module'],
            },
            {
                phrase: 'import module os',
                description: 'Adds import statement for "os" module',
                action: 'IMPORT_MODULE',
                aliases: ['import os'],
                isPrimary: true,
            },
            {
                phrase: 'import numpy',
                description: 'Adds import statement for numpy',
                action: 'IMPORT_MODULE',
                isPrimary: true,
            },
            {
                phrase: 'import module requests',
                description: 'Adds import for requests library',
                action: 'IMPORT_MODULE',
            },
            {
                phrase: 'import json',
                description: 'Adds import for JSON module',
                action: 'IMPORT_MODULE',
            },
        ],
    },

    // ========================================================================
    // 8. VARIABLE & SYMBOL OPERATIONS
    // ========================================================================
    {
        name: 'Variable & Symbol Operations',
        description: 'Rename variables, find symbols, and manage code elements.',
        icon: '🏷️',
        commands: [
            {
                phrase: 'rename variable x to y',
                description: 'Renames all occurrences of "x" to "y"',
                action: 'EDIT_RENAME',
                aliases: ['rename x to y'],
                isPrimary: true,
            },
            {
                phrase: 'rename function old to new',
                description: 'Renames a function throughout the file',
                action: 'EDIT_RENAME',
                isPrimary: true,
            },
            {
                phrase: 'rename class Dog to Animal',
                description: 'Renames a class throughout the file',
                action: 'EDIT_RENAME',
            },
            {
                phrase: 'rename variable count to total',
                description: 'Renames count to total everywhere in file',
                action: 'EDIT_RENAME',
                isPrimary: true,
            },
            {
                phrase: 'rename method getName to fetchName',
                description: 'Renames a method throughout the file',
                action: 'EDIT_RENAME',
            },
            {
                phrase: 'find variable count',
                description: 'Finds and moves cursor to "count"',
                action: 'FIND_SYMBOL',
                aliases: ['search for count', 'locate count'],
                isPrimary: true,
            },
            {
                phrase: 'find function main',
                description: 'Finds and moves cursor to "main" function',
                action: 'FIND_SYMBOL',
                aliases: ['search for main', 'locate main'],
            },
            {
                phrase: 'find class Calculator',
                description: 'Finds the Calculator class definition',
                action: 'FIND_SYMBOL',
            },
            {
                phrase: 'search for total',
                description: 'Finds "total" in the file',
                action: 'FIND_SYMBOL',
            },
            {
                phrase: 'locate variable result',
                description: 'Finds "result" variable in the file',
                action: 'FIND_SYMBOL',
            },
        ],
    },

    // ========================================================================
    // 9. VOICE CONTROL
    // ========================================================================
    {
        name: 'Voice Control',
        description: 'Control the voice assistant itself.',
        icon: '🎤',
        commands: [
            {
                phrase: 'hey coder',
                description: 'Wake word — activates the assistant',
                action: 'WAKE',
                aliases: ['activate coding assistant', 'start voice coding'],
                isPrimary: true,
            },
            {
                phrase: 'stop voice coding',
                description: 'Deactivation — returns to passive listening',
                action: 'DEACTIVATE',
                aliases: ['sleep assistant', 'deactivate coding assistant', 'stop coding'],
                isPrimary: true,
            },
            {
                phrase: 'go to sleep',
                description: 'Puts the assistant into passive mode',
                action: 'DEACTIVATE',
                aliases: ['goodbye', 'goodbye coder', 'goodbye assistant'],
            },
            {
                phrase: 'yes',
                description: 'Confirms a safety prompt (e.g., delete file)',
                action: 'CONFIRM',
                aliases: ['yes please', 'confirm', 'do it', 'go ahead'],
            },
            {
                phrase: 'no',
                description: 'Cancels a safety prompt',
                action: 'DENY',
                aliases: ['cancel', 'no thanks', 'abort', 'never mind'],
            },
            {
                phrase: 'help',
                description: 'Shows available voice commands',
                action: 'HELP',
                aliases: ['show commands', 'what can I say', 'list commands'],
            },
            {
                phrase: 'start continuous listening',
                description: 'Starts hands-free continuous mode',
                action: 'START_CONTINUOUS',
            },
            {
                phrase: 'stop listening',
                description: 'Stops all voice listening',
                action: 'STOP',
                aliases: ['stop', 'halt', 'quit listening'],
            },
            {
                phrase: 'activate now',
                description: 'Immediately activates without wake word',
                action: 'ACTIVATE_NOW',
            },
            {
                phrase: 'toggle voice feedback',
                description: 'Toggles text-to-speech on/off',
                action: 'TOGGLE_TTS',
                aliases: ['mute voice', 'unmute voice'],
            },
        ],
    },

    // ========================================================================
    // 10. AI CODE GENERATION (Free-Form)
    // ========================================================================
    {
        name: 'AI Code Generation',
        description: 'Free-form code generation using AI. Say anything descriptive.',
        icon: '🤖',
        commands: [
            {
                phrase: 'write a function to calculate fibonacci',
                description: 'AI generates a fibonacci function',
                action: 'AI_GENERATE',
                isPrimary: true,
            },
            {
                phrase: 'generate a REST API endpoint',
                description: 'AI generates API boilerplate',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'create a sorting algorithm',
                description: 'AI generates sorting code',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'write a hello world program',
                description: 'AI generates hello world in current language',
                action: 'AI_GENERATE',
                isPrimary: true,
            },
            {
                phrase: 'generate a calculator program',
                description: 'AI generates a calculator implementation',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'write code to read a CSV file',
                description: 'AI generates CSV reading code',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'create a login form validation',
                description: 'AI generates validation code',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'write unit tests for add function',
                description: 'AI generates test code',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'generate database CRUD operations',
                description: 'AI generates database operations',
                action: 'AI_GENERATE',
            },
            {
                phrase: 'write a web scraper',
                description: 'AI generates web scraping code',
                action: 'AI_GENERATE',
            },
        ],
    },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets all commands across all categories.
 *
 * @returns Flat array of all voice commands
 */
export function getAllCommands(): VoiceCommand[] {
    return COMMAND_DICTIONARY.flatMap(category => category.commands);
}

/**
 * Gets only the primary/most-common commands.
 *
 * @returns Array of primary voice commands
 */
export function getPrimaryCommands(): VoiceCommand[] {
    return getAllCommands().filter(cmd => cmd.isPrimary);
}

/**
 * Gets the total number of supported commands.
 *
 * @returns Total command count
 */
export function getCommandCount(): number {
    let count = 0;
    for (const category of COMMAND_DICTIONARY) {
        for (const cmd of category.commands) {
            count += 1 + (cmd.aliases?.length || 0);
        }
    }
    return count;
}

/**
 * Searches the command dictionary for commands matching a query.
 *
 * @param query - Search term
 * @returns Matching commands
 */
export function searchCommands(query: string): VoiceCommand[] {
    const lowerQuery = query.toLowerCase();
    return getAllCommands().filter(cmd =>
        cmd.phrase.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        cmd.aliases?.some(a => a.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Gets commands for a specific category.
 *
 * @param categoryName - Category name
 * @returns Commands in that category
 */
export function getCommandsByCategory(categoryName: string): VoiceCommand[] {
    const category = COMMAND_DICTIONARY.find(
        c => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    return category?.commands || [];
}

/**
 * Generates a formatted help text showing all available commands.
 * This can be displayed in the VS Code output panel or spoken by TTS.
 *
 * @returns Formatted help text
 */
export function getFormattedHelp(): string {
    const lines: string[] = [
        '═══════════════════════════════════════════════════════════════',
        '  Voice Coding Assistant — Command Reference',
        '═══════════════════════════════════════════════════════════════',
        '',
        `Total supported commands: ${getCommandCount()}+`,
        '',
    ];

    for (const category of COMMAND_DICTIONARY) {
        lines.push(`${category.icon}  ${category.name}`);
        lines.push(`   ${category.description}`);
        lines.push('   ─────────────────────────────────────────');

        for (const cmd of category.commands) {
            lines.push(`   "${cmd.phrase}"`);
            lines.push(`      → ${cmd.description}`);
            if (cmd.example) {
                lines.push(`      📋 ${cmd.example}`);
            }
            if (cmd.aliases && cmd.aliases.length > 0) {
                lines.push(`      Also: "${cmd.aliases.join('", "')}"`);
            }
        }
        lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  Tips:');
    lines.push('  • Speak clearly and naturally');
    lines.push('  • Wait 1 second after the activation beep');
    lines.push('  • Use "Hey Coder" to activate, "Stop" to deactivate');
    lines.push('  • Any unrecognized command is sent to AI for code generation');
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
}

/**
 * Gets a short summary of command categories for quick help.
 *
 * @returns Short help text
 */
export function getQuickHelp(): string {
    return COMMAND_DICTIONARY
        .map(c => `${c.icon} ${c.name}: ${c.commands.length} commands`)
        .join('\n');
}

/**
 * Validates if a spoken phrase is likely a valid command.
 * Returns the best matching command entry, or null.
 *
 * @param phrase - The spoken phrase to validate
 * @returns The best matching VoiceCommand, or null
 */
export function findMatchingCommand(phrase: string): VoiceCommand | null {
    const lower = phrase.toLowerCase().trim();

    // Exact phrase match
    const exact = getAllCommands().find(cmd =>
        cmd.phrase.toLowerCase() === lower
    );
    if (exact) { return exact; }

    // Alias match
    const aliasMatch = getAllCommands().find(cmd =>
        cmd.aliases?.some(a => a.toLowerCase() === lower)
    );
    if (aliasMatch) { return aliasMatch; }

    // Partial match (phrase starts with command)
    const partial = getAllCommands().find(cmd =>
        lower.startsWith(cmd.phrase.toLowerCase().split(' ').slice(0, 2).join(' '))
    );
    return partial || null;
}
