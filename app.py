from flask import Flask, render_template, request, jsonify, send_from_directory
from pathlib import Path
import subprocess
import os
import shutil
import uuid

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB total upload limit

BASE_DIR = Path(__file__).resolve().parent
WORKSPACE = BASE_DIR / "workspace"
WORKSPACE.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {".js", ".mjs", ".cjs"}
MAX_FILES = 10
MAX_FILE_SIZE = 1 * 1024 * 1024

def eslint_command(args):
    """Run the locally installed ESLint CLI on this machine."""
    if os.name == "nt":
        return ["cmd", "/c", "npx", "eslint", *args]
    return ["npx", "eslint", *args]

def run_eslint(fix=False):
    if not (BASE_DIR / "node_modules" / "eslint").exists():
        return None, "ESLint is not installed yet. Run: npm install"

    targets = [p.name for p in WORKSPACE.iterdir()
               if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS]
    if not targets:
        return [], "Upload at least one .js, .mjs or .cjs file first."

    args = (["--fix"] if fix else []) + ["--format", "json"] + targets
    try:
        result = subprocess.run(
            eslint_command(args),
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=25
        )
        # ESLint returns exit code 1 when it finds lint issues. Its JSON output
        # is still valid and is what we need to display.
        import json
        raw = result.stdout.strip()
        if not raw:
            return None, result.stderr.strip() or "ESLint did not return a report."
        reports = json.loads(raw)
        summary = {
            "files": [],
            "errorCount": 0,
            "warningCount": 0,
            "fixableErrorCount": 0,
            "fixableWarningCount": 0
        }
        for report in reports:
            rel = Path(report["filePath"]).name
            messages = []
            for item in report.get("messages", []):
                messages.append({
                    "rule": item.get("ruleId") or "parser",
                    "message": item.get("message", "Issue detected"),
                    "line": item.get("line") or 1,
                    "column": item.get("column") or 1,
                    "severity": "error" if item.get("severity") == 2 else "warning",
                    "fixable": bool(item.get("fix"))
                })
            summary["files"].append({
                "name": rel,
                "messages": messages,
                "errorCount": report.get("errorCount", 0),
                "warningCount": report.get("warningCount", 0)
            })
            for key in ("errorCount", "warningCount", "fixableErrorCount", "fixableWarningCount"):
                summary[key] += report.get(key, 0)
        return summary, None
    except subprocess.TimeoutExpired:
        return None, "Linting took too long and was stopped."
    except Exception as exc:
        return None, f"Could not run ESLint: {exc}"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/sample.js")
def sample_file():
    return send_from_directory(BASE_DIR, "sample.js", mimetype="text/javascript")

@app.post("/api/upload")
def upload():
    incoming = request.files.getlist("files")
    if not incoming or all(not f.filename for f in incoming):
        return jsonify(error="Choose one or more JavaScript files."), 400
    if len(incoming) > MAX_FILES:
        return jsonify(error=f"Upload up to {MAX_FILES} files at a time."), 400

    accepted = []
    rejected = []
    WORKSPACE.mkdir(exist_ok=True)
    # Replace the previous mission workspace with this upload.
    for old in WORKSPACE.iterdir():
        if old.is_file():
            old.unlink()
        elif old.is_dir():
            shutil.rmtree(old)

    for file in incoming:
        original = Path(file.filename or "").name
        suffix = Path(original).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            rejected.append(f"{original}: only .js, .mjs and .cjs files are supported")
            continue
        content = file.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            rejected.append(f"{original}: file exceeds 1 MB")
            continue
        if not content:
            rejected.append(f"{original}: file is empty")
            continue
        # Use a safe basename and avoid collisions.
        safe_name = "".join(c for c in original if c.isalnum() or c in "._-")
        if not safe_name or safe_name in {".", ".."}:
            safe_name = f"mission_{uuid.uuid4().hex[:8]}{suffix}"
        destination = WORKSPACE / safe_name
        if destination.exists():
            destination = WORKSPACE / f"{destination.stem}_{uuid.uuid4().hex[:5]}{suffix}"
        destination.write_bytes(content)
        accepted.append(destination.name)

    if not accepted:
        return jsonify(error="No supported files were uploaded.", rejected=rejected), 400
    report, error = run_eslint(fix=False)
    if error:
        return jsonify(error=error, rejected=rejected), 500
    return jsonify(files=accepted, rejected=rejected, report=report)

@app.post("/api/scan")
def scan():
    report, error = run_eslint(fix=False)
    if error:
        return jsonify(error=error), 400
    return jsonify(report=report)

@app.post("/api/attack")
def attack():
    # The player's attack triggers a real ESLint autofix pass on the uploaded code.
    before, error = run_eslint(fix=False)
    if error:
        return jsonify(error=error), 400
    after, error = run_eslint(fix=True)
    if error:
        return jsonify(error=error), 500
    return jsonify(before=before, report=after,
                   fixed=before["fixableErrorCount"] + before["fixableWarningCount"])

@app.get("/api/download/<path:filename>")
def download(filename):
    safe_name = Path(filename).name
    if safe_name != filename or Path(safe_name).suffix.lower() not in ALLOWED_EXTENSIONS:
        return jsonify(error="Invalid filename."), 400
    if not (WORKSPACE / safe_name).is_file():
        return jsonify(error="File not found."), 404
    return send_from_directory(WORKSPACE, safe_name, as_attachment=True)

@app.get("/api/files")
def list_files():
    names = [p.name for p in WORKSPACE.iterdir()
             if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS]
    return jsonify(files=names)

@app.get("/health")
def health():
    return jsonify(status="ok", app="Taskocalypse Lint Monster")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
