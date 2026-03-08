// ============================================================================
// VS Code Controller Module
// ============================================================================
// Executes actions in VS Code based on parsed commands.
//
// This module is the HANDS of the assistant — it performs the actual
// operations in the VS Code editor. Each function maps to a specific
// voice command category.
//
// RESPONSIBILITIES:
//   - File operations: create, open, save, close, run files
//   - Navigation: move cursor to specific lines, top, bottom
//   - Code insertion: insert generated code at cursor position
//   - Folder creation: create new directories
//   - Text replacement: for rename operations
//   - Terminal operations: run files, execute commands
//
// ARCHITECTURE:
//   ParsedCommand → vscodeController function → VS Code API calls → User sees result
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Creates a new file with the given name and extension.
 *
 * How it works:
 *   1. Determines the workspace folder (or uses home directory)
 *   2. Builds the full file path with extension
 *   3. Creates the file on disk (empty)
 *   4. Opens it in the editor
 *
 * @param fileName - Name of the file (without extension)
 * @param extension - File extension including dot (e.g., ".py")
 */
export async function createFile(fileName: string, extension: string): Promise<void> {
    console.log('[VSCodeController] Creating file:', fileName + extension);

    // Get the workspace folder, or fall back to home directory
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let basePath: string;

    if (workspaceFolders && workspaceFolders.length > 0) {
        basePath = workspaceFolders[0].uri.fsPath;
    } else {
        basePath = require('os').homedir();
    }

    const fullPath = path.join(basePath, fileName + extension);
    const fileUri = vscode.Uri.file(fullPath);

    // Create the file if it doesn't exist
    try {
        await vscode.workspace.fs.stat(fileUri);
        // File exists — open it
        console.log('[VSCodeController] File already exists, opening:', fullPath);
    } catch {
        // File doesn't exist — create it
        await vscode.workspace.fs.writeFile(fileUri, new Uint8Array(0));
        console.log('[VSCodeController] File created:', fullPath);
    }

    // Open the file in the editor
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`📄 Created: ${fileName}${extension}`);
}

/**
 * Opens an existing file by name.
 * Searches in the workspace for files matching the name.
 *
 * @param fileName - File name or partial name to search for
 */
export async function openFile(fileName: string): Promise<void> {
    console.log('[VSCodeController] Opening file:', fileName);

    // Search for files matching the name in the workspace
    const files = await vscode.workspace.findFiles(`**/${fileName}*`, '**/node_modules/**', 10);

    if (files.length === 0) {
        // Try without extension
        const filesNoExt = await vscode.workspace.findFiles(`**/${fileName}.*`, '**/node_modules/**', 10);
        if (filesNoExt.length === 0) {
            vscode.window.showWarningMessage(`⚠️ File not found: "${fileName}"`);
            return;
        }
        // Open the first match
        const doc = await vscode.workspace.openTextDocument(filesNoExt[0]);
        await vscode.window.showTextDocument(doc);
        return;
    }

    if (files.length === 1) {
        const doc = await vscode.workspace.openTextDocument(files[0]);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`📂 Opened: ${path.basename(files[0].fsPath)}`);
    } else {
        // Multiple matches — let user pick
        const items = files.map(f => ({
            label: path.basename(f.fsPath),
            description: vscode.workspace.asRelativePath(f),
            uri: f,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Multiple files found. Which one?',
        });

        if (picked) {
            const doc = await vscode.workspace.openTextDocument(picked.uri);
            await vscode.window.showTextDocument(doc);
        }
    }
}

/**
 * Saves the currently active file.
 */
export async function saveFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open to save.');
        return;
    }

    await editor.document.save();
    vscode.window.showInformationMessage(`💾 Saved: ${path.basename(editor.document.fileName)}`);
}

/**
 * Closes the currently active file/tab.
 */
export async function closeFile(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    vscode.window.showInformationMessage('❌ File closed.');
}

/**
 * Runs the currently active file in the integrated terminal.
 *
 * Determines the run command based on file extension:
 *   .py  → python <file>
 *   .js  → node <file>
 *   .ts  → npx ts-node <file>
 *   .java → javac <file> && java <classname>
 *   .go  → go run <file>
 *   .rs  → cargo run
 *   .rb  → ruby <file>
 *   .php → php <file>
 *   .sh  → bash <file>
 *   .ps1 → powershell <file>
 */
export async function runFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open to run.');
        return;
    }

    // Save first
    await editor.document.save();

    const filePath = editor.document.fileName;
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    // Determine the run command based on file extension
    let command: string;
    switch (ext) {
        case '.py':
            command = `python "${filePath}"`;
            break;
        case '.js':
            command = `node "${filePath}"`;
            break;
        case '.ts':
            command = `npx ts-node "${filePath}"`;
            break;
        case '.java':
            const className = path.basename(filePath, '.java');
            command = `javac "${filePath}" && java -cp "${path.dirname(filePath)}" ${className}`;
            break;
        case '.go':
            command = `go run "${filePath}"`;
            break;
        case '.rs':
            command = `cargo run`;
            break;
        case '.rb':
            command = `ruby "${filePath}"`;
            break;
        case '.php':
            command = `php "${filePath}"`;
            break;
        case '.sh':
            command = `bash "${filePath}"`;
            break;
        case '.ps1':
            command = `powershell -File "${filePath}"`;
            break;
        case '.c':
            const cOut = path.join(path.dirname(filePath), 'a.out');
            command = `gcc "${filePath}" -o "${cOut}" && "${cOut}"`;
            break;
        case '.cpp':
            const cppOut = path.join(path.dirname(filePath), 'a.out');
            command = `g++ "${filePath}" -o "${cppOut}" && "${cppOut}"`;
            break;
        default:
            command = `python "${filePath}"`; // default to Python
            break;
    }

    console.log('[VSCodeController] Running:', command);

    // Create or reuse a terminal
    const terminal = vscode.window.createTerminal('Voice Coding: Run');
    terminal.show();
    terminal.sendText(command);

    vscode.window.showInformationMessage(`▶️ Running: ${fileName}`);
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Moves the cursor to a specific line number.
 * Line numbers are 1-based (line 1 = first line).
 * Use lineNumber = -1 to go to the last line.
 *
 * @param lineNumber - The line number to navigate to (1-based, -1 for last line)
 */
export async function navigateToLine(lineNumber: number): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open.');
        return;
    }

    const doc = editor.document;
    let targetLine: number;

    if (lineNumber === -1) {
        // Go to last line
        targetLine = doc.lineCount - 1;
    } else {
        // Convert 1-based to 0-based, and clamp to valid range
        targetLine = Math.max(0, Math.min(lineNumber - 1, doc.lineCount - 1));
    }

    const position = new vscode.Position(targetLine, 0);
    const selection = new vscode.Selection(position, position);

    editor.selection = selection;
    editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
    );

    const displayLine = targetLine + 1; // Display as 1-based
    vscode.window.showInformationMessage(`📍 Cursor at line ${displayLine}`);
}

// ============================================================================
// CODE INSERTION
// ============================================================================

/**
 * Inserts code at the current cursor position in the active editor.
 * If no editor is open, creates a new untitled document.
 *
 * @param code - The code string to insert
 * @param language - Optional language ID for new documents (default: "python")
 */
export async function insertCode(code: string, language?: string): Promise<void> {
    let editor = vscode.window.activeTextEditor;

    if (!editor) {
        console.log('[VSCodeController] No active editor, creating new document...');
        const doc = await vscode.workspace.openTextDocument({
            content: '',
            language: language || 'python',
        });
        editor = await vscode.window.showTextDocument(doc);
    }

    await editor.edit((editBuilder) => {
        const position = editor!.selection.active;
        editBuilder.insert(position, code + '\n');
    });

    console.log('[VSCodeController] Code inserted at cursor position.');
}

/**
 * Replaces the entire content of the active editor.
 * Used by "fix error" to replace buggy code with fixed code.
 *
 * @param newCode - The new code to replace the entire file with
 */
export async function replaceAllCode(newCode: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open.');
        return;
    }

    const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
    );

    await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, newCode);
    });

    console.log('[VSCodeController] Entire file content replaced.');
}

/**
 * Gets the text of a specific line in the active editor.
 *
 * @param lineNumber - 1-based line number
 * @returns The text of the line, or null if out of range
 */
export function getLineText(lineNumber: number): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return null; }

    const zeroBasedLine = lineNumber - 1;
    if (zeroBasedLine < 0 || zeroBasedLine >= editor.document.lineCount) {
        return null;
    }

    return editor.document.lineAt(zeroBasedLine).text;
}

/**
 * Gets ALL text from the active editor.
 *
 * @returns The full document text, or null if no editor is open
 */
export function getAllText(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return null; }
    return editor.document.getText();
}

/**
 * Gets the file extension of the currently active file.
 *
 * @returns Extension like ".py", ".js", or empty string if no file
 */
export function getCurrentFileExtension(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return ''; }
    return path.extname(editor.document.fileName).toLowerCase();
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

/**
 * Creates a new folder in the workspace.
 *
 * @param folderName - Name of the folder to create
 */
export async function createFolder(folderName: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('⚠️ No workspace folder open. Open a folder first.');
        return;
    }

    const basePath = workspaceFolders[0].uri.fsPath;
    const folderPath = path.join(basePath, folderName);

    if (fs.existsSync(folderPath)) {
        vscode.window.showInformationMessage(`📁 Folder already exists: ${folderName}`);
        return;
    }

    fs.mkdirSync(folderPath, { recursive: true });
    vscode.window.showInformationMessage(`📁 Created folder: ${folderName}`);
}

// ============================================================================
// RENAME
// ============================================================================

/**
 * Renames all occurrences of a symbol in the active file.
 * This does a simple find-and-replace (not a semantic rename).
 *
 * @param oldName - Current name
 * @param newName - New name to replace it with
 */
export async function renameSymbol(oldName: string, newName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open.');
        return;
    }

    const text = editor.document.getText();
    const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedOldName}\\b`, 'g');

    let matchCount = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        matchCount++;
    }

    if (matchCount === 0) {
        vscode.window.showWarningMessage(`⚠️ "${oldName}" not found in the current file.`);
        return;
    }

    // Perform the replacement
    const newText = text.replace(new RegExp(`\\b${escapedOldName}\\b`, 'g'), newName);

    const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(text.length)
    );

    await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, newText);
    });

    vscode.window.showInformationMessage(
        `✏️ Renamed "${oldName}" → "${newName}" (${matchCount} occurrences)`
    );
}

// ============================================================================
// IMPORT MODULE
// ============================================================================

/**
 * Inserts an import statement at the top of the file.
 * Detects the language from the file extension and uses the appropriate syntax.
 *
 * @param moduleName - The module to import
 */
export async function importModule(moduleName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('⚠️ No file is open.');
        return;
    }

    const ext = path.extname(editor.document.fileName).toLowerCase();
    let importStatement: string;

    switch (ext) {
        case '.py':
            importStatement = `import ${moduleName}`;
            break;
        case '.js':
        case '.jsx':
            importStatement = `const ${moduleName} = require('${moduleName}');`;
            break;
        case '.ts':
        case '.tsx':
            importStatement = `import ${moduleName} from '${moduleName}';`;
            break;
        case '.java':
            importStatement = `import ${moduleName};`;
            break;
        case '.go':
            importStatement = `import "${moduleName}"`;
            break;
        case '.rs':
            importStatement = `use ${moduleName};`;
            break;
        case '.rb':
            importStatement = `require '${moduleName}'`;
            break;
        case '.php':
            importStatement = `use ${moduleName};`;
            break;
        default:
            importStatement = `import ${moduleName}`;
            break;
    }

    // Insert at the top of the file (line 0, character 0)
    await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(0, 0), importStatement + '\n');
    });

    vscode.window.showInformationMessage(`📦 Imported: ${moduleName}`);
}

// ============================================================================
// SHOW DEBUG OUTPUT
// ============================================================================

/**
 * Shows debug/analysis output in an output channel (bottom panel).
 * Used for displaying error explanations from the AI.
 *
 * @param title - Title for the output section
 * @param content - Content to display
 */
export function showOutput(title: string, content: string): void {
    const channel = vscode.window.createOutputChannel('Voice Coding Assistant');
    channel.clear();
    channel.appendLine('═'.repeat(60));
    channel.appendLine(`  ${title}`);
    channel.appendLine('═'.repeat(60));
    channel.appendLine('');
    channel.appendLine(content);
    channel.appendLine('');
    channel.appendLine('═'.repeat(60));
    channel.show();
}
