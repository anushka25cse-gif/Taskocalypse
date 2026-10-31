# TASKOCALYPSE — Lint Monster

A hackathon-ready gamified JavaScript linting prototype. Players upload JavaScript files, scan them with ESLint, and trigger real ESLint automatic fixes by attacking the Lint Monster.

## What works

- Upload up to 10 JavaScript files (`.js`, `.mjs`, `.cjs`), up to 1 MB each.
- ESLint scans the uploaded source and reports errors, warnings, locations and fixability.
- The **ATTACK / AUTO-FIX** action runs ESLint with `--fix` against the real uploaded files.
- The app rescans the code and shows what remains.
- Download the updated files.
- A sample file is included so the demo works immediately.

**Honest limitation:** ESLint only auto-fixes rules for which a safe fix is available. Some issues (for example, unused variables) need a developer to decide what to change. The app displays those as remaining issues; it does not claim they were fixed.

## Requirements

- Python 3.10+
- Node.js 18+ and npm

Check installation:

```bash
python --version
node --version
npm --version
```

## Run on Windows

Open Command Prompt or the VS Code terminal in this project folder:

```bash
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
npm install
py app.py
```

If `py` is not recognised, use `python` instead:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
npm install
python app.py
```

## Run on macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
npm install
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

## 60-second demo

1. Click **LOAD DEMO CODE**. This loads the included `sample.js` with intentional lint issues.
2. Click **SCAN CODE**. The issue count and monster appear from the actual ESLint report.
3. Click **ATTACK / AUTO-FIX**. This calls the Flask backend, which runs `npx eslint --fix` on the uploaded code.
4. Watch fixable issues disappear from the report. Non-fixable warnings remain visible.
5. Click **DOWNLOAD FIXED CODE** to download the real updated JavaScript file.

## Architecture

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Python Flask
- Lint engine: ESLint 9 flat config
- Automation: ESLint CLI `--fix`
- Storage: local temporary `workspace/` folder

## Safety and scope

This is a local, single-user hackathon MVP. It accepts JavaScript source files only, limits upload size, sanitizes filenames, and does not execute uploaded code. ESLint parses and analyses the source. Do not expose the development Flask server publicly as-is; production deployment needs authentication, per-user isolated workspaces, CSRF protection, stricter rate limits and a hardened upload pipeline.
