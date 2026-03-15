# 🎤 Voice Coding Assistant — Complete Guide

> **An AI-powered VS Code extension that lets you code entirely using voice commands.**
> Designed for users with hand disabilities — no keyboard or mouse required.

---

## 📁 Project Structure

```
voice-coding-assistant/
├── .env                      ← Your OpenRouter API key
├── .gitignore
├── .vscode/
│   ├── launch.json           ← F5 debug configuration
│   └── tasks.json            ← TypeScript watch task
├── src/
│   ├── extension.ts          ← Main entry point (orchestrator)
│   ├── voiceRecorder.ts      ← Microphone recording via SoX
│   ├── speechToText.ts       ← Audio → Text via Deepgram Cloud API
│   ├── commandParser.ts      ← Text → Structured command (the brain)
│   ├── aiEngine.ts           ← AI code generation via OpenRouter
│   └── vscodeController.ts   ← Execute actions in VS Code (the hands)
├── out/                      ← Compiled JavaScript (auto-generated)
├── package.json              ← Extension manifest & dependencies
├── tsconfig.json             ← TypeScript configuration
└── node_modules/             ← Installed packages
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Voice Command Flow                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   🎤 Microphone                                        │
│    │                                                    │
│    ▼                                                    │
│   📼 SoX (voiceRecorder.ts)                            │
│    │  Records 16kHz mono WAV audio                      │
│    │                                                    │
│    ▼                                                    │
│   📝 Deepgram (speechToText.ts)                         │
│    │  Converts speech → text                            │
│    │  Lightning fast (< 300ms) and handles accents                       │
│    │                                                    │
│    ▼                                                    │
│   🧠 Command Parser (commandParser.ts)                 │
│    │  Maps text → structured command                    │
│    │  e.g. "create python file" → FILE_CREATE           │
│    │                                                    │
│    ├──────────────────────┐                             │
│    │ Direct Commands      │ AI-Needed Commands          │
│    │ (save, close, nav)   │ (insert code, debug, fix)  │
│    ▼                      ▼                             │
│   🖥️ VS Code Controller   🤖 AI Engine (aiEngine.ts)   │
│   (vscodeController.ts)   │  OpenRouter API             │
│    │                      │                             │
│    └──────────────────────┘                             │
│    │                                                    │
│    ▼                                                    │
│   ✅ Action Executed in VS Code                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Module Responsibilities

| Module | File | What It Does |
|--------|------|--------------|
| **Voice Recorder** | [voiceRecorder.ts](file:///d:/assistant/voice-coding-assistant/src/voiceRecorder.ts) | Records audio from microphone using SoX (16kHz mono WAV) |
| **Speech-to-Text** | [speechToText.ts](file:///d:/assistant/voice-coding-assistant/src/speechToText.ts) | Converts WAV audio to text using Deepgram Cloud API |
| **Command Parser** | [commandParser.ts](file:///d:/assistant/voice-coding-assistant/src/commandParser.ts) | Interprets transcribed text into structured commands using regex patterns |
| **AI Engine** | [aiEngine.ts](file:///d:/assistant/voice-coding-assistant/src/aiEngine.ts) | Sends prompts to OpenRouter API, returns generated/debugged code |
| **VS Code Controller** | [vscodeController.ts](file:///d:/assistant/voice-coding-assistant/src/vscodeController.ts) | Executes VS Code actions: file ops, navigation, code insertion, terminal |
| **Extension** | [extension.ts](file:///d:/assistant/voice-coding-assistant/src/extension.ts) | Main orchestrator — ties everything together, handles safety fallbacks |

---

## 🗣️ Supported Voice Commands

### File Operations

| Voice Command | Action |
|--------------|--------|
| "Create a python file" | Creates `main.py` |
| "Create a javascript file named app" | Creates `app.js` |
| "Create a file called calculator" | Creates `calculator.py` |
| "Open file utils.py" | Opens `utils.py` |
| "Save file" / "Save this" | Saves the active file |
| "Close file" / "Close this" | Closes the active tab |
| "Run file" / "Run this" | Executes the file in terminal |

### Navigation

| Voice Command | Action |
|--------------|--------|
| "Go to line 10" / "Navigate to line 10" | Moves cursor to line 10 |
| "Go to top" / "Go to top of file" | Moves cursor to line 1 |
| "Go to bottom" / "Go to end" | Moves cursor to last line |

### Code Insertion (AI-Powered)

| Voice Command | Action |
|--------------|--------|
| "Insert function to add two numbers" | AI generates `def add(a, b): return a + b` |
| "Define variable called name" | AI generates variable declaration |
| "Create class called Animal" | AI generates class with constructor |
| "Add constructor" | AI generates constructor method |
| "Create loop to print 1 to 10" | AI generates for/while loop |
| "Add if condition" | AI generates if/else block |
| "Call function add" | AI generates function call |
| "Add error handling" / "Add try catch" | AI generates try/except block |

### Debugging & Error Fixing (AI-Powered)

| Voice Command | Action |
|--------------|--------|
| "Debug error in line 15" | AI analyzes line 15 and suggests fix |
| "Explain error" | AI explains the error in the file |
| "Fix this error" | AI rewrites the file with the error fixed |

### Editing

| Voice Command | Action |
|--------------|--------|
| "Rename variable x to y" | Renames all occurrences of `x` to `y` |
| "Import module os" | Inserts `import os` at top of file |
| "Import numpy" | Inserts `import numpy` at top |

### Project Management

| Voice Command | Action |
|--------------|--------|
| "Create new folder utils" | Creates `utils/` directory |
| "Create new project" | Opens folder picker for new project |

### Fallback (Any Other Command)

| Voice Command | Action |
|--------------|--------|
| Anything not matching above patterns | Sent to AI for code generation |

---

## 🛡️ Safety Fallback System

```
Speech Recognition Attempt
    │
    ├── ✅ Success → Show result, ask for confirmation
    │       ├── "Execute" → Run the command
    │       ├── "Retry Recording" → Record again
    │       ├── "Type Instead" → Manual text input
    │       └── "Cancel" → Stop
    │
    └── ❌ Failure (empty / no speech detected)
            │
            ├── Attempt 1 of 3 → "Retry" / "Type Command" / "Cancel"
            ├── Attempt 2 of 3 → "Retry" / "Type Command" / "Cancel"
            └── Attempt 3 of 3 → "Type Command" / "Cancel"
                                   │
                                   └── Opens text input box
                                       User types: "create python file"
                                       → Parsed and executed normally
```

> [!IMPORTANT]
> If speech recognition keeps failing, the system offers a **manual text input** fallback. This ensures the user is never stuck — they can type the command instead.

---

## 🔧 Installation Guide

### STEP 1: Install Node.js

Node.js is required to run the extension.

1. Download from: https://nodejs.org/ (LTS version)
2. Install it with default settings
3. Verify:
```powershell
node --version
# Expected: v20.x.x or higher

npm --version
# Expected: 10.x.x or higher
```

### STEP 4: Get API Keys

1. **Deepgram (Speech-to-Text)**
   - Go to: https://console.deepgram.com
   - Sign up / Log in
   - Create a project and API Key

2. **OpenRouter (AI Code Gen)**
   - Go to: https://openrouter.ai
2. Sign up / Log in
3. Go to: https://openrouter.ai/keys
4. Click "Create Key"
5. Copy the key

### STEP 5: Configure the Extension

Edit the `.env` file at `d:\assistant\voice-coding-assistant\.env`:

```env
DEEPGRAM_API_KEY=your-deepgram-key-here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### STEP 6: Install Dependencies

```powershell
cd d:\assistant\voice-coding-assistant
npm install
```

**Expected result:** `node_modules/` folder is created with all packages.

### STEP 7: Compile the Extension

```powershell
npm run compile
```

**Expected result:** TypeScript files in `src/` are compiled to JavaScript in `out/`. No errors.

---

## 🚀 Running the Extension

### STEP 8: Launch in Debug Mode

1. Open the project in VS Code: `d:\assistant\voice-coding-assistant`
2. Press **F5** (or go to Run → Start Debugging)
3. VS Code opens a **new window** called the **Extension Development Host**
4. This new window has your extension loaded and active

> [!NOTE]
> **Extension Development Host** is a separate VS Code instance where your extension runs. Any changes you make in the extension code require restarting this host (press F5 again).

### STEP 9: Test the Extension

In the Extension Development Host window:

1. Press **Ctrl+Shift+P** to open the Command Palette
2. Type **"Voice Coding"** — you should see 4 commands:
   - `Voice Coding: Hello World (Test)`
   - `Voice Coding: Start Listening`
   - `Voice Coding: Stop Listening`
   - `Voice Coding: Type Command (Manual)`

3. First, run **"Voice Coding: Hello World"** to verify the extension is active.

---

## 🧪 Testing Voice Commands

### Test 1: Manual Command (No Microphone Needed)

1. Press **Ctrl+Shift+T** (or Command Palette → "Voice Coding: Type Command")
2. Type: `create a python file`
3. **Expected:** A new `main.py` file is created and opened

### Test 2: Navigation

1. Open any file with multiple lines
2. Press **Ctrl+Shift+T**
3. Type: `go to line 5`
4. **Expected:** Cursor moves to line 5

### Test 3: Voice Command

1. Make sure your microphone is connected and enabled
2. Press **Ctrl+Shift+V** (or Command Palette → "Voice Coding: Start Listening")
3. Speak: **"Create a python file"**
4. Wait for Deepgram transcription
5. Click **"Execute"** when prompted
6. **Expected:** `main.py` is created

### Test 4: AI Code Generation

1. Open a `.py` file
2. Press **Ctrl+Shift+T**
3. Type: `insert function to add two numbers`
4. **Expected:** AI generates and inserts:
   ```python
   def add(a, b):
       return a + b
   ```

### Test 5: Run File

1. Open a Python file with some code
2. Press **Ctrl+Shift+T**
3. Type: `run file`
4. **Expected:** Terminal opens and runs `python <filename>`

### Test 6: Debug

1. Open a file with an intentional error
2. Press **Ctrl+Shift+T**
3. Type: `debug error in line 2`
4. **Expected:** AI analyzes the code and shows explanation in Output panel

---

## ⚠️ Troubleshooting

### Microphone Not Detected

**Symptoms:** "SoX is NOT installed" or "Microphone recording failed"

**Solution:**
1. Verify SoX: `sox --version`
2. Check microphone in Windows Settings → Sound → Input
3. Check Privacy: Settings → Privacy → Microphone → Allow apps to access
4. Try recording manually: `sox -t waveaudio default -r 16000 -c 1 -b 16 test.wav trim 0 3`
5. Restart VS Code after PATH changes

### Speech Recognition Failing

**Symptoms:** "Could not detect speech" or Deepgram errors

**Solution:**
1. Verify you have internet access (Cloud API requires it).
2. Check your Deepgram API Key in `.env` or settings.
3. Speak more clearly and closer to the microphone.
4. Record for longer (Settings → recordingDurationMs → 10000)
5. Use the **"Type Command"** fallback in the meantime.

### AI Not Responding

**Symptoms:** "OpenRouter API error" or timeout

**Solution:**
1. Check your API key in `.env`
2. Check credits at https://openrouter.ai/credits
3. Try a different model in Settings (e.g., `meta-llama/llama-3-8b-instruct`)
4. Check internet connection
5. Look at error code:
   - 401 = invalid API key
   - 402 = insufficient credits
   - 429 = rate limit (wait and retry)

### Commands Not Executing

**Symptoms:** Command is parsed but nothing happens

**Solution:**
1. Make sure a file is open for navigation/save/close commands
2. Check the Output panel (View → Output → "Voice Coding Assistant")
3. Check the Debug Console (if running in F5 mode) for error messages
4. Try the "Type Command" option to rule out speech recognition issues

### Extension Not Activating

**Symptoms:** Commands don't show in Command Palette

**Solution:**
1. Make sure `npm run compile` succeeded with no errors
2. Check that `out/extension.js` exists
3. In F5 mode, check the Debug Console for activation errors
4. Try: `npm install` then `npm run compile` again
5. Restart VS Code completely

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+V** | Start voice recording |
| **Ctrl+Shift+X** | Stop recording |
| **Ctrl+Shift+T** | Type command manually |

---

## ⚙️ Settings

Open VS Code Settings (Ctrl+,) and search for "Voice Coding":

| Setting | Default | Description |
|---------|---------|-------------|
| `openRouterModel` | `openai/gpt-3.5-turbo` | AI model for code generation |
| `recordingDurationMs` | `7000` | Recording duration (milliseconds) |
| `deepgramApiKey` | `""` | Deepgram API Key (can also be in .env) |

### Recommended Models

| Model | Cost | Quality | Speed |
|-------|------|---------|-------|
| `openai/gpt-3.5-turbo` | Low | Good | Fast |
| `openai/gpt-4` | High | Excellent | Slow |
| `anthropic/claude-3-haiku` | Low | Good | Fast |
| `meta-llama/llama-3-8b-instruct` | Very Low | Good | Fast |
| `google/gemini-pro` | Low | Good | Fast |

---



## 🏗️ How Each Module Works

### 1. voiceRecorder.ts — Microphone Recording

```
recordAudio(config) → Promise<RecordingResult>
```

- Spawns SoX as a subprocess
- On Windows: uses `-t waveaudio default` to access microphone
- Records at 16kHz, mono, 16-bit WAV (what Deepgram expects)
- Returns the file path, duration, and file size
- Automatically cleans up temp files after use

### 2. speechToText.ts — Deepgram Integration

```
transcribeAudio(audioFilePath, mode) → Promise<TranscriptionResult>
```

- Calls Deepgram's Cloud API (`nova-2` model)
- Converts WAV audio to text directly using Axios
- Extremely fast (< 500ms latency)
- Returns JSON with transcribed text

### 3. commandParser.ts — The Brain

```
parseCommand(text) → ParsedCommand
```

- 14 command types with regex-based pattern matching
- Patterns handle natural speech variations:
  - "create a python file" ✓
  - "make a new python file" ✓
  - "new python file" ✓
- First matching pattern wins (priority order)
- Unrecognized commands → AI_GENERATE fallback
- Supports 30+ spoken language names → file extensions

### 4. aiEngine.ts — OpenRouter AI

```
generateCode(prompt, config) → Promise<AIResult>
debugCode(code, config, lineNumber?) → Promise<AIResult>
fixError(code, config) → Promise<AIResult>
generateCodeConcept(concept, description, config) → Promise<AIResult>
```

- 3 different system prompts optimized for:
  - Code generation (output only raw code)
  - Debugging (explain error + provide fix)
  - Error fixing (output only fixed code)
- Cleans markdown code fences from AI output
- Comprehensive error handling with helpful messages

### 5. vscodeController.ts — The Hands

```
createFile(name, ext)     → Creates file on disk + opens in editor
openFile(name)            → Searches workspace + opens file
saveFile()                → Saves active editor
closeFile()               → Closes active tab
runFile()                 → Detects language, runs in terminal
navigateToLine(line)      → Moves cursor to line
insertCode(code)          → Inserts at cursor position
replaceAllCode(code)      → Replaces entire file (for error fixes)
renameSymbol(old, new)    → Find-replace all occurrences
importModule(name)        → Inserts import at top (language-aware)
createFolder(name)        → Creates directory in workspace
showOutput(title, content)→ Shows in Output panel
```

### 6. extension.ts — The Orchestrator

- Registers 4 commands with VS Code
- Creates status bar item (shows recording state)
- Runs the full pipeline: Record → Transcribe → Parse → Execute
- Implements safety fallback (retry + manual input)
- Manages global state (isRecording flag)

---

## 📝 Supported Programming Languages

The assistant can create files in these languages:

| Language | Extension | Voice Example |
|----------|-----------|---------------|
| Python | `.py` | "Create a python file" |
| JavaScript | `.js` | "Create a javascript file" |
| TypeScript | `.ts` | "Create a typescript file" |
| Java | `.java` | "Create a java file" |
| C# | `.cs` | "Create a c sharp file" |
| C++ | `.cpp` | "Create a c plus plus file" |
| C | `.c` | "Create a c file" |
| Go | `.go` | "Create a go file" |
| Rust | `.rs` | "Create a rust file" |
| Ruby | `.rb` | "Create a ruby file" |
| PHP | `.php` | "Create a php file" |
| Swift | `.swift` | "Create a swift file" |
| Kotlin | `.kt` | "Create a kotlin file" |
| HTML | `.html` | "Create a html file" |
| CSS | `.css` | "Create a css file" |
| SQL | `.sql` | "Create a sql file" |
| Dart | `.dart` | "Create a dart file" |
| R | `.r` | "Create an r file" |
| Shell | `.sh` | "Create a shell file" |
| PowerShell | `.ps1` | "Create a powershell file" |
| Markdown | `.md` | "Create a markdown file" |
| JSON | `.json` | "Create a json file" |

---

## 🔄 Run Commands by Language

When you say "run file", the extension detects the file type and uses the correct command:

| Extension | Run Command |
|-----------|-------------|
| `.py` | `python "file.py"` |
| `.js` | `node "file.js"` |
| `.ts` | `npx ts-node "file.ts"` |
| `.java` | `javac "file.java" && java ClassName` |
| `.go` | `go run "file.go"` |
| `.rb` | `ruby "file.rb"` |
| `.php` | `php "file.php"` |
| `.sh` | `bash "file.sh"` |
| `.ps1` | `powershell -File "file.ps1"` |
| `.c` | `gcc "file.c" -o a.out && a.out` |
| `.cpp` | `g++ "file.cpp" -o a.out && a.out` |
