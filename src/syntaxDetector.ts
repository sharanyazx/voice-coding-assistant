// ============================================================================
// Syntax Detector Module
// ============================================================================
// Determines code generation rules based on the file extension of the active
// editor. This ensures that when a user says "create function add numbers",
// the generated code matches the language they're working in.
//
// SUPPORTED LANGUAGES (Priority order):
//   1. Java      (.java)   — public static, camelCase, classes required
//   2. Python    (.py)     — def, snake_case, indentation-based
//   3. JavaScript(.js)     — function/const, camelCase, semicolons
//   4. TypeScript (.ts)    — typed, camelCase, export conventions
//   5. C++       (.cpp/.cc)— #include, namespaces, manual memory
//   6. C         (.c/.h)   — procedural, printf, malloc/free
//
// ADDITIONAL LANGUAGES:
//   Go, Rust, Ruby, PHP, C#, Kotlin, Swift, Dart, Scala, R, Lua, Perl
//
// HOW IT WORKS:
//   1. Get the file extension from the active editor
//   2. Look up the LanguageProfile for that extension
//   3. Return syntax rules, naming conventions, and code patterns
//   4. The AI Engine uses this profile to generate accurate code
//
// ARCHITECTURE:
//   Active editor → file extension → syntaxDetector → LanguageProfile
//     → AI Engine uses profile in system prompt → correct code output
// ============================================================================

import * as vscode from 'vscode';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Complete profile for a programming language.
 * Used by the AI Engine to generate syntactically correct code.
 */
export interface LanguageProfile {
    /** Language identifier (e.g., "python", "java") */
    id: string;

    /** Human-readable name (e.g., "Python", "Java") */
    name: string;

    /** File extension including dot (e.g., ".py", ".java") */
    extension: string;

    /** VS Code language ID for document creation */
    vscodeLanguageId: string;

    /** Naming convention rules */
    namingConvention: NamingConvention;

    /** Syntax rules for code generation */
    syntaxRules: SyntaxRules;

    /** Common boilerplate templates */
    templates: CodeTemplates;

    /** Import/include statement format */
    importFormat: string;

    /** Comment style (single-line) */
    commentSingle: string;

    /** Comment style (multi-line start/end) */
    commentMultiStart: string;
    commentMultiEnd: string;

    /** Whether the language uses semicolons */
    usesSemicolons: boolean;

    /** Whether the language uses braces for blocks */
    usesBraces: boolean;

    /** Indentation style (spaces or tabs, and count) */
    indentation: string;

    /** Common standard library modules */
    commonImports: string[];

    /** Run command template (use {file} as placeholder) */
    runCommand: string;

    /** File header boilerplate (if any) */
    fileHeader?: string;
}

/**
 * Naming convention rules for a language.
 */
export interface NamingConvention {
    /** Function naming: "snake_case", "camelCase", "PascalCase" */
    functions: string;

    /** Variable naming */
    variables: string;

    /** Class naming */
    classes: string;

    /** Constant naming */
    constants: string;

    /** Method naming */
    methods: string;

    /** File naming convention */
    files: string;
}

/**
 * Syntax rules that govern code generation.
 */
export interface SyntaxRules {
    /** How to declare a function */
    functionDeclaration: string;

    /** How to declare a variable */
    variableDeclaration: string;

    /** How to declare a class */
    classDeclaration: string;

    /** How to write an if-else */
    conditionalSyntax: string;

    /** How to write a for loop */
    forLoopSyntax: string;

    /** How to write a while loop */
    whileLoopSyntax: string;

    /** How to handle errors/exceptions */
    errorHandling: string;

    /** How to print/log output */
    printStatement: string;

    /** Type system: "static", "dynamic", "gradual" */
    typeSystem: string;

    /** Entry point convention */
    entryPoint?: string;
}

/**
 * Common code templates for quick generation.
 */
export interface CodeTemplates {
    /** Empty function */
    emptyFunction: string;

    /** Class with constructor */
    classWithConstructor: string;

    /** For loop (iterate N times) */
    forLoop: string;

    /** While loop */
    whileLoop: string;

    /** If-else block */
    ifElse: string;

    /** Try-catch/except block */
    tryCatch: string;

    /** Main entry point */
    mainFunction: string;

    /** Print/log statement */
    print: string;
}

// ============================================================================
// Language Profiles Database
// ============================================================================

const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {

    // ========================================================================
    // PRIORITY LANGUAGE: Python
    // ========================================================================
    '.py': {
        id: 'python',
        name: 'Python',
        extension: '.py',
        vscodeLanguageId: 'python',
        namingConvention: {
            functions: 'snake_case',
            variables: 'snake_case',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'snake_case',
            files: 'snake_case',
        },
        syntaxRules: {
            functionDeclaration: 'def function_name(param1, param2):',
            variableDeclaration: 'variable_name = value',
            classDeclaration: 'class ClassName:',
            conditionalSyntax: 'if condition:\n    # body\nelif other:\n    # body\nelse:\n    # body',
            forLoopSyntax: 'for item in iterable:',
            whileLoopSyntax: 'while condition:',
            errorHandling: 'try:\n    # code\nexcept Exception as e:\n    # handle',
            printStatement: 'print(value)',
            typeSystem: 'dynamic',
            entryPoint: 'if __name__ == "__main__":',
        },
        templates: {
            emptyFunction: 'def function_name():\n    pass',
            classWithConstructor: 'class ClassName:\n    def __init__(self):\n        pass',
            forLoop: 'for i in range(n):\n    pass',
            whileLoop: 'while condition:\n    pass',
            ifElse: 'if condition:\n    pass\nelse:\n    pass',
            tryCatch: 'try:\n    pass\nexcept Exception as e:\n    print(f"Error: {e}")',
            mainFunction: 'def main():\n    pass\n\nif __name__ == "__main__":\n    main()',
            print: 'print("Hello, World!")',
        },
        importFormat: 'import {module}',
        commentSingle: '#',
        commentMultiStart: '"""',
        commentMultiEnd: '"""',
        usesSemicolons: false,
        usesBraces: false,
        indentation: '    ',
        commonImports: ['os', 'sys', 'json', 'math', 'datetime', 'typing', 'collections', 're'],
        runCommand: 'python "{file}"',
    },

    // ========================================================================
    // PRIORITY LANGUAGE: Java
    // ========================================================================
    '.java': {
        id: 'java',
        name: 'Java',
        extension: '.java',
        vscodeLanguageId: 'java',
        namingConvention: {
            functions: 'camelCase',
            variables: 'camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'camelCase',
            files: 'PascalCase',
        },
        syntaxRules: {
            functionDeclaration: 'public returnType methodName(Type param) { }',
            variableDeclaration: 'Type variableName = value;',
            classDeclaration: 'public class ClassName { }',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (int i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: 'try {\n    // code\n} catch (Exception e) {\n    // handle\n}',
            printStatement: 'System.out.println(value);',
            typeSystem: 'static',
            entryPoint: 'public static void main(String[] args) { }',
        },
        templates: {
            emptyFunction: 'public void methodName() {\n    \n}',
            classWithConstructor: 'public class ClassName {\n    public ClassName() {\n        \n    }\n}',
            forLoop: 'for (int i = 0; i < n; i++) {\n    \n}',
            whileLoop: 'while (condition) {\n    \n}',
            ifElse: 'if (condition) {\n    \n} else {\n    \n}',
            tryCatch: 'try {\n    \n} catch (Exception e) {\n    System.out.println("Error: " + e.getMessage());\n}',
            mainFunction: 'public static void main(String[] args) {\n    \n}',
            print: 'System.out.println("Hello, World!");',
        },
        importFormat: 'import {module};',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['java.util.*', 'java.io.*', 'java.lang.*', 'java.util.ArrayList', 'java.util.HashMap'],
        runCommand: 'javac "{file}" && java -cp "{dir}" {classname}',
        fileHeader: 'public class {ClassName} {',
    },

    // ========================================================================
    // JavaScript
    // ========================================================================
    '.js': {
        id: 'javascript',
        name: 'JavaScript',
        extension: '.js',
        vscodeLanguageId: 'javascript',
        namingConvention: {
            functions: 'camelCase',
            variables: 'camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'camelCase',
            files: 'camelCase or kebab-case',
        },
        syntaxRules: {
            functionDeclaration: 'function functionName(param1, param2) { }',
            variableDeclaration: 'const variableName = value;',
            classDeclaration: 'class ClassName { }',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (let i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: 'try {\n    // code\n} catch (error) {\n    // handle\n}',
            printStatement: 'console.log(value);',
            typeSystem: 'dynamic',
        },
        templates: {
            emptyFunction: 'function functionName() {\n    \n}',
            classWithConstructor: 'class ClassName {\n    constructor() {\n        \n    }\n}',
            forLoop: 'for (let i = 0; i < n; i++) {\n    \n}',
            whileLoop: 'while (condition) {\n    \n}',
            ifElse: 'if (condition) {\n    \n} else {\n    \n}',
            tryCatch: 'try {\n    \n} catch (error) {\n    console.error("Error:", error.message);\n}',
            mainFunction: 'function main() {\n    \n}\n\nmain();',
            print: 'console.log("Hello, World!");',
        },
        importFormat: "const {module} = require('{module}');",
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['fs', 'path', 'http', 'express', 'axios', 'lodash'],
        runCommand: 'node "{file}"',
    },

    '.jsx': undefined as unknown as LanguageProfile, // alias set below

    // ========================================================================
    // TypeScript
    // ========================================================================
    '.ts': {
        id: 'typescript',
        name: 'TypeScript',
        extension: '.ts',
        vscodeLanguageId: 'typescript',
        namingConvention: {
            functions: 'camelCase',
            variables: 'camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'camelCase',
            files: 'camelCase or kebab-case',
        },
        syntaxRules: {
            functionDeclaration: 'function functionName(param: Type): ReturnType { }',
            variableDeclaration: 'const variableName: Type = value;',
            classDeclaration: 'class ClassName { }',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (let i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: 'try {\n    // code\n} catch (error: unknown) {\n    // handle\n}',
            printStatement: 'console.log(value);',
            typeSystem: 'static',
        },
        templates: {
            emptyFunction: 'function functionName(): void {\n    \n}',
            classWithConstructor: 'class ClassName {\n    constructor() {\n        \n    }\n}',
            forLoop: 'for (let i = 0; i < n; i++) {\n    \n}',
            whileLoop: 'while (condition) {\n    \n}',
            ifElse: 'if (condition) {\n    \n} else {\n    \n}',
            tryCatch: 'try {\n    \n} catch (error: unknown) {\n    console.error("Error:", (error as Error).message);\n}',
            mainFunction: 'function main(): void {\n    \n}\n\nmain();',
            print: 'console.log("Hello, World!");',
        },
        importFormat: "import {module} from '{module}';",
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['fs', 'path', 'vscode', 'express', 'axios'],
        runCommand: 'npx ts-node "{file}"',
    },

    '.tsx': undefined as unknown as LanguageProfile, // alias set below

    // ========================================================================
    // C++
    // ========================================================================
    '.cpp': {
        id: 'cpp',
        name: 'C++',
        extension: '.cpp',
        vscodeLanguageId: 'cpp',
        namingConvention: {
            functions: 'camelCase or snake_case',
            variables: 'camelCase or snake_case',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE or k-prefix (kConstant)',
            methods: 'camelCase',
            files: 'snake_case or PascalCase',
        },
        syntaxRules: {
            functionDeclaration: 'returnType functionName(Type param) { }',
            variableDeclaration: 'Type variableName = value;',
            classDeclaration: 'class ClassName {\npublic:\n    ClassName();\n};',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (int i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: 'try {\n    // code\n} catch (const std::exception& e) {\n    // handle\n}',
            printStatement: 'std::cout << value << std::endl;',
            typeSystem: 'static',
            entryPoint: 'int main() {\n    return 0;\n}',
        },
        templates: {
            emptyFunction: 'void functionName() {\n    \n}',
            classWithConstructor: 'class ClassName {\npublic:\n    ClassName() {\n        \n    }\n};',
            forLoop: 'for (int i = 0; i < n; i++) {\n    \n}',
            whileLoop: 'while (condition) {\n    \n}',
            ifElse: 'if (condition) {\n    \n} else {\n    \n}',
            tryCatch: 'try {\n    \n} catch (const std::exception& e) {\n    std::cerr << "Error: " << e.what() << std::endl;\n}',
            mainFunction: '#include <iostream>\n\nint main() {\n    \n    return 0;\n}',
            print: 'std::cout << "Hello, World!" << std::endl;',
        },
        importFormat: '#include <{module}>',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['iostream', 'string', 'vector', 'map', 'algorithm', 'cmath', 'fstream'],
        runCommand: 'g++ "{file}" -o a.out && ./a.out',
    },

    '.cc': undefined as unknown as LanguageProfile, // alias set below
    '.cxx': undefined as unknown as LanguageProfile,
    '.hpp': undefined as unknown as LanguageProfile,

    // ========================================================================
    // C
    // ========================================================================
    '.c': {
        id: 'c',
        name: 'C',
        extension: '.c',
        vscodeLanguageId: 'c',
        namingConvention: {
            functions: 'snake_case',
            variables: 'snake_case',
            classes: 'N/A (use structs with PascalCase)',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'N/A',
            files: 'snake_case',
        },
        syntaxRules: {
            functionDeclaration: 'returnType function_name(Type param) { }',
            variableDeclaration: 'Type variable_name = value;',
            classDeclaration: 'typedef struct {\n    // fields\n} StructName;',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (int i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: '/* C uses error codes and errno */\nif (result == -1) {\n    perror("Error");\n}',
            printStatement: 'printf("%d\\n", value);',
            typeSystem: 'static',
            entryPoint: 'int main(int argc, char *argv[]) {\n    return 0;\n}',
        },
        templates: {
            emptyFunction: 'void function_name(void) {\n    \n}',
            classWithConstructor: 'typedef struct {\n    int field;\n} StructName;\n\nStructName* create_struct(void) {\n    StructName* s = malloc(sizeof(StructName));\n    s->field = 0;\n    return s;\n}',
            forLoop: 'for (int i = 0; i < n; i++) {\n    \n}',
            whileLoop: 'while (condition) {\n    \n}',
            ifElse: 'if (condition) {\n    \n} else {\n    \n}',
            tryCatch: '/* C uses error codes */\nint result = some_function();\nif (result != 0) {\n    fprintf(stderr, "Error: %d\\n", result);\n}',
            mainFunction: '#include <stdio.h>\n\nint main(int argc, char *argv[]) {\n    \n    return 0;\n}',
            print: 'printf("Hello, World!\\n");',
        },
        importFormat: '#include <{module}.h>',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['stdio', 'stdlib', 'string', 'math', 'stdbool', 'stdint', 'assert'],
        runCommand: 'gcc "{file}" -o a.out && ./a.out',
    },

    '.h': undefined as unknown as LanguageProfile, // alias set below

    // ========================================================================
    // Go
    // ========================================================================
    '.go': {
        id: 'go',
        name: 'Go',
        extension: '.go',
        vscodeLanguageId: 'go',
        namingConvention: {
            functions: 'camelCase (unexported) / PascalCase (exported)',
            variables: 'camelCase',
            classes: 'PascalCase (structs)',
            constants: 'PascalCase or camelCase',
            methods: 'PascalCase (exported)',
            files: 'snake_case',
        },
        syntaxRules: {
            functionDeclaration: 'func functionName(param Type) ReturnType { }',
            variableDeclaration: 'var variableName Type = value // or variableName := value',
            classDeclaration: 'type StructName struct {\n    Field Type\n}',
            conditionalSyntax: 'if condition {\n    // body\n} else if other {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for i := 0; i < n; i++ { }',
            whileLoopSyntax: 'for condition { }',
            errorHandling: 'result, err := someFunc()\nif err != nil {\n    // handle\n}',
            printStatement: 'fmt.Println(value)',
            typeSystem: 'static',
            entryPoint: 'func main() { }',
        },
        templates: {
            emptyFunction: 'func functionName() {\n    \n}',
            classWithConstructor: 'type StructName struct {\n    Field int\n}\n\nfunc NewStructName() *StructName {\n    return &StructName{}\n}',
            forLoop: 'for i := 0; i < n; i++ {\n    \n}',
            whileLoop: 'for condition {\n    \n}',
            ifElse: 'if condition {\n    \n} else {\n    \n}',
            tryCatch: 'result, err := someFunc()\nif err != nil {\n    log.Fatal(err)\n}',
            mainFunction: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
            print: 'fmt.Println("Hello, World!")',
        },
        importFormat: 'import "{module}"',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: false,
        usesBraces: true,
        indentation: '\t',
        commonImports: ['fmt', 'os', 'log', 'strings', 'strconv', 'net/http', 'encoding/json'],
        runCommand: 'go run "{file}"',
    },

    // ========================================================================
    // Rust
    // ========================================================================
    '.rs': {
        id: 'rust',
        name: 'Rust',
        extension: '.rs',
        vscodeLanguageId: 'rust',
        namingConvention: {
            functions: 'snake_case',
            variables: 'snake_case',
            classes: 'PascalCase (structs/enums)',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'snake_case',
            files: 'snake_case',
        },
        syntaxRules: {
            functionDeclaration: 'fn function_name(param: Type) -> ReturnType { }',
            variableDeclaration: 'let variable_name: Type = value;',
            classDeclaration: 'struct StructName {\n    field: Type,\n}',
            conditionalSyntax: 'if condition {\n    // body\n} else if other {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for item in iterator { }',
            whileLoopSyntax: 'while condition { }',
            errorHandling: 'match result {\n    Ok(val) => { },\n    Err(e) => { },\n}',
            printStatement: 'println!("{}", value);',
            typeSystem: 'static',
            entryPoint: 'fn main() { }',
        },
        templates: {
            emptyFunction: 'fn function_name() {\n    \n}',
            classWithConstructor: 'struct StructName {\n    field: i32,\n}\n\nimpl StructName {\n    fn new() -> Self {\n        StructName { field: 0 }\n    }\n}',
            forLoop: 'for i in 0..n {\n    \n}',
            whileLoop: 'while condition {\n    \n}',
            ifElse: 'if condition {\n    \n} else {\n    \n}',
            tryCatch: 'match some_function() {\n    Ok(value) => println!("{}", value),\n    Err(e) => eprintln!("Error: {}", e),\n}',
            mainFunction: 'fn main() {\n    println!("Hello, World!");\n}',
            print: 'println!("Hello, World!");',
        },
        importFormat: 'use {module};',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['std::io', 'std::fs', 'std::collections::HashMap', 'std::fmt'],
        runCommand: 'cargo run',
    },

    // ========================================================================
    // C#
    // ========================================================================
    '.cs': {
        id: 'csharp',
        name: 'C#',
        extension: '.cs',
        vscodeLanguageId: 'csharp',
        namingConvention: {
            functions: 'PascalCase',
            variables: 'camelCase',
            classes: 'PascalCase',
            constants: 'PascalCase',
            methods: 'PascalCase',
            files: 'PascalCase',
        },
        syntaxRules: {
            functionDeclaration: 'public ReturnType MethodName(Type param) { }',
            variableDeclaration: 'Type variableName = value;',
            classDeclaration: 'public class ClassName { }',
            conditionalSyntax: 'if (condition) {\n    // body\n} else if (other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for (int i = 0; i < n; i++) { }',
            whileLoopSyntax: 'while (condition) { }',
            errorHandling: 'try {\n    // code\n} catch (Exception ex) {\n    // handle\n}',
            printStatement: 'Console.WriteLine(value);',
            typeSystem: 'static',
            entryPoint: 'static void Main(string[] args) { }',
        },
        templates: {
            emptyFunction: 'public void MethodName()\n{\n    \n}',
            classWithConstructor: 'public class ClassName\n{\n    public ClassName()\n    {\n        \n    }\n}',
            forLoop: 'for (int i = 0; i < n; i++)\n{\n    \n}',
            whileLoop: 'while (condition)\n{\n    \n}',
            ifElse: 'if (condition)\n{\n    \n}\nelse\n{\n    \n}',
            tryCatch: 'try\n{\n    \n}\ncatch (Exception ex)\n{\n    Console.WriteLine($"Error: {ex.Message}");\n}',
            mainFunction: 'using System;\n\nclass Program\n{\n    static void Main(string[] args)\n    {\n        \n    }\n}',
            print: 'Console.WriteLine("Hello, World!");',
        },
        importFormat: 'using {module};',
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: ['System', 'System.Collections.Generic', 'System.Linq', 'System.IO'],
        runCommand: 'dotnet run',
    },

    // ========================================================================
    // Ruby
    // ========================================================================
    '.rb': {
        id: 'ruby',
        name: 'Ruby',
        extension: '.rb',
        vscodeLanguageId: 'ruby',
        namingConvention: {
            functions: 'snake_case',
            variables: 'snake_case',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'snake_case',
            files: 'snake_case',
        },
        syntaxRules: {
            functionDeclaration: 'def method_name(param)\n  # body\nend',
            variableDeclaration: 'variable_name = value',
            classDeclaration: 'class ClassName\nend',
            conditionalSyntax: 'if condition\n  # body\nelsif other\n  # body\nelse\n  # body\nend',
            forLoopSyntax: 'n.times do |i|\n  # body\nend',
            whileLoopSyntax: 'while condition\n  # body\nend',
            errorHandling: 'begin\n  # code\nrescue => e\n  # handle\nend',
            printStatement: 'puts value',
            typeSystem: 'dynamic',
        },
        templates: {
            emptyFunction: 'def method_name\n  \nend',
            classWithConstructor: 'class ClassName\n  def initialize\n    \n  end\nend',
            forLoop: 'n.times do |i|\n  \nend',
            whileLoop: 'while condition\n  \nend',
            ifElse: 'if condition\n  \nelse\n  \nend',
            tryCatch: 'begin\n  \nrescue => e\n  puts "Error: #{e.message}"\nend',
            mainFunction: 'def main\n  \nend\n\nmain',
            print: 'puts "Hello, World!"',
        },
        importFormat: "require '{module}'",
        commentSingle: '#',
        commentMultiStart: '=begin',
        commentMultiEnd: '=end',
        usesSemicolons: false,
        usesBraces: false,
        indentation: '  ',
        commonImports: ['json', 'net/http', 'fileutils', 'csv', 'date'],
        runCommand: 'ruby "{file}"',
    },

    // ========================================================================
    // PHP
    // ========================================================================
    '.php': {
        id: 'php',
        name: 'PHP',
        extension: '.php',
        vscodeLanguageId: 'php',
        namingConvention: {
            functions: 'camelCase or snake_case',
            variables: '$camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE_CASE',
            methods: 'camelCase',
            files: 'PascalCase or kebab-case',
        },
        syntaxRules: {
            functionDeclaration: 'function functionName($param) { }',
            variableDeclaration: '$variableName = value;',
            classDeclaration: 'class ClassName { }',
            conditionalSyntax: 'if ($condition) {\n    // body\n} elseif ($other) {\n    // body\n} else {\n    // body\n}',
            forLoopSyntax: 'for ($i = 0; $i < $n; $i++) { }',
            whileLoopSyntax: 'while ($condition) { }',
            errorHandling: 'try {\n    // code\n} catch (Exception $e) {\n    // handle\n}',
            printStatement: 'echo $value;',
            typeSystem: 'dynamic',
        },
        templates: {
            emptyFunction: 'function functionName() {\n    \n}',
            classWithConstructor: 'class ClassName {\n    public function __construct() {\n        \n    }\n}',
            forLoop: 'for ($i = 0; $i < $n; $i++) {\n    \n}',
            whileLoop: 'while ($condition) {\n    \n}',
            ifElse: 'if ($condition) {\n    \n} else {\n    \n}',
            tryCatch: 'try {\n    \n} catch (Exception $e) {\n    echo "Error: " . $e->getMessage();\n}',
            mainFunction: '<?php\n\nfunction main() {\n    \n}\n\nmain();\n',
            print: 'echo "Hello, World!\\n";',
        },
        importFormat: "require_once '{module}';",
        commentSingle: '//',
        commentMultiStart: '/*',
        commentMultiEnd: '*/',
        usesSemicolons: true,
        usesBraces: true,
        indentation: '    ',
        commonImports: [],
        runCommand: 'php "{file}"',
    },
};

// Set up aliases (extensions that share the same profile)
LANGUAGE_PROFILES['.jsx'] = { ...LANGUAGE_PROFILES['.js'], extension: '.jsx' };
LANGUAGE_PROFILES['.tsx'] = { ...LANGUAGE_PROFILES['.ts'], extension: '.tsx' };
LANGUAGE_PROFILES['.cc'] = { ...LANGUAGE_PROFILES['.cpp'], extension: '.cc' };
LANGUAGE_PROFILES['.cxx'] = { ...LANGUAGE_PROFILES['.cpp'], extension: '.cxx' };
LANGUAGE_PROFILES['.hpp'] = { ...LANGUAGE_PROFILES['.cpp'], extension: '.hpp' };
LANGUAGE_PROFILES['.h'] = { ...LANGUAGE_PROFILES['.c'], extension: '.h' };

// ============================================================================
// Default Profile (fallback)
// ============================================================================

const DEFAULT_PROFILE: LanguageProfile = LANGUAGE_PROFILES['.py'];

// ============================================================================
// Public API
// ============================================================================

/**
 * Detects the programming language from the currently active editor file.
 *
 * @returns LanguageProfile for the detected language
 */
export function detectLanguage(): LanguageProfile {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        console.log('[SyntaxDetector] No active editor, defaulting to Python.');
        return DEFAULT_PROFILE;
    }

    const ext = path.extname(editor.document.fileName).toLowerCase();
    const profile = LANGUAGE_PROFILES[ext];

    if (profile) {
        console.log('[SyntaxDetector] Detected:', profile.name, '(', ext, ')');
        return profile;
    }

    // Try VS Code's language ID as fallback
    const langId = editor.document.languageId;
    const profileByLangId = Object.values(LANGUAGE_PROFILES).find(
        p => p && p.vscodeLanguageId === langId
    );

    if (profileByLangId) {
        console.log('[SyntaxDetector] Detected by language ID:', profileByLangId.name);
        return profileByLangId;
    }

    console.log('[SyntaxDetector] Unknown extension:', ext, '— defaulting to Python.');
    return DEFAULT_PROFILE;
}

/**
 * Gets a LanguageProfile by file extension.
 *
 * @param extension - File extension including dot (e.g., ".py")
 * @returns LanguageProfile or the default (Python) if not found
 */
export function getProfileByExtension(extension: string): LanguageProfile {
    return LANGUAGE_PROFILES[extension.toLowerCase()] || DEFAULT_PROFILE;
}

/**
 * Gets a LanguageProfile by language name.
 *
 * @param languageName - Language name (e.g., "python", "java")
 * @returns LanguageProfile or the default (Python) if not found
 */
export function getProfileByName(languageName: string): LanguageProfile {
    const name = languageName.toLowerCase();

    // Direct extension lookup
    const extMap: Record<string, string> = {
        'python': '.py',
        'java': '.java',
        'javascript': '.js',
        'typescript': '.ts',
        'c++': '.cpp',
        'cpp': '.cpp',
        'c plus plus': '.cpp',
        'c': '.c',
        'go': '.go',
        'golang': '.go',
        'rust': '.rs',
        'ruby': '.rb',
        'php': '.php',
        'csharp': '.cs',
        'c sharp': '.cs',
        'c#': '.cs',
    };

    const ext = extMap[name];
    if (ext) {
        return LANGUAGE_PROFILES[ext] || DEFAULT_PROFILE;
    }

    return DEFAULT_PROFILE;
}

/**
 * Generates a system prompt suffix for the AI engine that contains
 * language-specific instructions.
 *
 * @param profile - The detected language profile
 * @returns A string to append to the AI system prompt
 */
export function getAIPromptContext(profile: LanguageProfile): string {
    return `
IMPORTANT: Generate code in ${profile.name} programming language.

LANGUAGE-SPECIFIC RULES:
- Language: ${profile.name} (${profile.extension})
- Naming conventions:
  - Functions: ${profile.namingConvention.functions}
  - Variables: ${profile.namingConvention.variables}
  - Classes: ${profile.namingConvention.classes}
  - Constants: ${profile.namingConvention.constants}
- Uses semicolons: ${profile.usesSemicolons ? 'Yes' : 'No'}
- Uses braces for blocks: ${profile.usesBraces ? 'Yes' : 'No'}
- Indentation: ${profile.usesBraces ? '4 spaces' : (profile.id === 'go' ? 'tabs' : '4 spaces')}
- Type system: ${profile.syntaxRules.typeSystem}
- Print statement: ${profile.syntaxRules.printStatement}
- Error handling: ${profile.syntaxRules.errorHandling}
- Import format: ${profile.importFormat}

EXAMPLE PATTERNS:
- Function: ${profile.syntaxRules.functionDeclaration}
- Variable: ${profile.syntaxRules.variableDeclaration}
- Class: ${profile.syntaxRules.classDeclaration}
- For loop: ${profile.syntaxRules.forLoopSyntax}
- Conditional: ${profile.syntaxRules.conditionalSyntax}

Generate ONLY valid ${profile.name} code. Follow the naming conventions strictly.
Do NOT include markdown code fences. Output raw code only.
`.trim();
}

/**
 * Gets all supported language names and their extensions.
 * Useful for displaying help information.
 *
 * @returns Array of { name, extension } pairs
 */
export function getSupportedLanguages(): Array<{ name: string; extension: string }> {
    const seen = new Set<string>();
    const result: Array<{ name: string; extension: string }> = [];

    for (const profile of Object.values(LANGUAGE_PROFILES)) {
        if (profile && !seen.has(profile.id)) {
            seen.add(profile.id);
            result.push({ name: profile.name, extension: profile.extension });
        }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Converts a natural language function/variable name to the correct
 * convention for the given language.
 *
 * Example:
 *   convertName("add two numbers", "python", "function") → "add_two_numbers"
 *   convertName("add two numbers", "java", "function") → "addTwoNumbers"
 *   convertName("add two numbers", "java", "class") → "AddTwoNumbers"
 *
 * @param spokenName - Natural language name (e.g., "add two numbers")
 * @param profile - The language profile
 * @param kind - "function" | "variable" | "class" | "constant"
 * @returns Properly formatted name
 */
export function convertName(
    spokenName: string,
    profile: LanguageProfile,
    kind: 'function' | 'variable' | 'class' | 'constant'
): string {
    // Split into words
    const words = spokenName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);

    if (words.length === 0) { return 'unnamed'; }

    // Determine target convention
    let convention: string;
    switch (kind) {
        case 'function': convention = profile.namingConvention.functions; break;
        case 'variable': convention = profile.namingConvention.variables; break;
        case 'class': convention = profile.namingConvention.classes; break;
        case 'constant': convention = profile.namingConvention.constants; break;
    }

    // Apply convention (use the primary convention if multiple are listed)
    if (convention.includes('snake_case') && !convention.startsWith('PascalCase')) {
        return words.join('_');
    } else if (convention.includes('UPPER_SNAKE_CASE') || convention.includes('UPPER')) {
        return words.join('_').toUpperCase();
    } else if (convention.startsWith('PascalCase')) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    } else if (convention.includes('camelCase')) {
        return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    }

    // Fallback: camelCase
    return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
