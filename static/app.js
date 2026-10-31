const $ = (id) => document.getElementById(id);
let currentFiles = [];
let currentReport = null;
let xp = 0, coins = 0, fixedTotal = 0, totalIssuesAtStart = 0;
let busy = false;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}
function log(message) {
  const row = document.createElement("div");
  row.className = "log-entry";
  const dot = document.createElement("i"); dot.className = "log-dot";
  const text = document.createElement("span"); text.textContent = message;
  const time = document.createElement("time"); time.textContent = "NOW";
  row.append(dot, text, time);
  $("activityLog").prepend(row);
  while ($("activityLog").children.length > 7) $("activityLog").lastElementChild.remove();
}
function setBusy(value) {
  busy = value;
  $("loadDemoBtn").disabled = value;
  $("fileInput").disabled = value;
  $("scanBtn").disabled = value || !currentFiles.length;
  $("attackBtn").disabled = value || !currentFiles.length;
}
async function api(url, options={}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
function updatePlayer() {
  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  $("xpValue").textContent = xp;
  $("coinValue").textContent = coins;
  $("fixedValue").textContent = fixedTotal;
  $("levelValue").textContent = String(level).padStart(2,"0");
  $("levelSide").textContent = String(level).padStart(2,"0");
  $("xpProgress").style.width = progress + "%";
  $("xpProgressLabel").textContent = `${progress} / 100 XP`;
}
function renderReport(report) {
  currentReport = report;
  $("errorCount").textContent = report.errorCount;
  $("warningCount").textContent = report.warningCount;
  $("fixableCount").textContent = report.fixableErrorCount + report.fixableWarningCount;
  const total = report.errorCount + report.warningCount;
  const hp = totalIssuesAtStart ? Math.max(0, Math.round(total / totalIssuesAtStart * 100)) : (total ? 100 : 0);
  $("bossHp").style.width = hp + "%";
  $("bossHpText").textContent = hp + "%";
  $("monster").style.opacity = total === 0 ? ".35" : "1";
  $("missionStatus").textContent = total === 0 ? "MISSION CLEAR" : "BOSS DETECTED";
  $("missionStatus").classList.toggle("ready", total === 0);
  $("downloadBtn").disabled = !currentFiles.length;
  $("attackBtn").disabled = !currentFiles.length || total === 0 || busy;
  $("scanBtn").disabled = !currentFiles.length || busy;
  const container = $("fileList");
  container.replaceChildren();
  if (!report.files.length) {
    container.innerHTML = '<div class="empty-state"><b>No JavaScript files found</b></div>';
    return;
  }
  report.files.forEach(file => {
    const block = document.createElement("div"); block.className = "file-block";
    const title = document.createElement("div"); title.className = "file-title"; title.textContent = "▸ " + file.name;
    block.append(title);
    if (!file.messages.length) {
      const clean = document.createElement("div"); clean.className = "no-issues"; clean.textContent = "✓ CLEAN CODE — no lint issues found";
      block.append(clean);
    } else {
      file.messages.forEach(issue => {
        const row = document.createElement("div"); row.className = "issue-row " + (issue.severity === "warning" ? "severity-warning" : "");
        const loc = document.createElement("span"); loc.className = "issue-location"; loc.textContent = `${issue.line}:${issue.column}`;
        const msg = document.createElement("span"); msg.textContent = issue.message;
        const rule = document.createElement("span"); rule.className = "issue-rule"; rule.textContent = issue.rule;
        const meta = document.createElement("div"); meta.style.gridColumn = "2 / 4"; meta.style.display = "flex"; meta.style.justifyContent = "space-between";
        const sev = document.createElement("small"); sev.textContent = issue.severity.toUpperCase(); sev.style.color = issue.severity === "error" ? "#ff8094" : "#ffd17a";
        const fix = document.createElement("small"); fix.className = "fix-tag"; fix.textContent = issue.fixable ? "AUTO-FIX AVAILABLE" : "MANUAL REVIEW";
        meta.append(sev,fix); row.append(loc,msg,rule,meta); block.append(row);
      });
    }
    container.append(block);
  });
}
async function uploadFiles(fileList) {
  if (!fileList || !fileList.length) return;
  setBusy(true);
  try {
    const form = new FormData();
    [...fileList].forEach(file => form.append("files", file));
    const data = await api("/api/upload", {method:"POST",body:form});
    currentFiles = data.files;
    totalIssuesAtStart = data.report.errorCount + data.report.warningCount;
    renderReport(data.report);
    $("missionStatus").textContent = "BOSS DETECTED";
    log(`Uploaded ${currentFiles.length} file(s). ESLint scan complete.`);
    log(`${data.report.errorCount + data.report.warningCount} issue(s) found. Choose ATTACK to autofix.`);
    toast("Mission loaded. The Lint Monster is awake!");
    if (data.rejected?.length) toast(data.rejected.join(" · "));
  } catch (err) { toast(err.message); log("Upload failed: " + err.message); }
  finally { setBusy(false); $("scanBtn").disabled = !currentFiles.length; $("attackBtn").disabled = !currentFiles.length || !currentReport || (currentReport.errorCount + currentReport.warningCount === 0); }
}
$("fileInput").addEventListener("change", e => uploadFiles(e.target.files));
$("loadDemoBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/sample.js");
    const blob = await response.blob();
    const file = new File([blob], "sample.js", {type:"text/javascript"});
    await uploadFiles([file]);
  } catch (err) { toast("Could not load sample: " + err.message); }
});
$("scanBtn").addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  try {
    const data = await api("/api/scan",{method:"POST"});
    renderReport(data.report);
    totalIssuesAtStart = Math.max(totalIssuesAtStart, data.report.errorCount + data.report.warningCount);
    log("Code scanned. Battle report refreshed.");
    toast("Scan complete.");
  } catch(err) { toast(err.message); }
  finally { setBusy(false); }
});
$("attackBtn").addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  $("monster").classList.add("hit");
  log("Player attack launched. Running ESLint autofix...");
  try {
    const data = await api("/api/attack",{method:"POST"});
    const fixed = data.fixed || 0;
    fixedTotal += fixed;
    xp += fixed * 15 + 10;
    coins += fixed * 5 + 5;
    updatePlayer();
    renderReport(data.report);
    log(`Autofix pass complete: ${fixed} fixable issue(s) reported before the pass.`);
    if (data.report.errorCount + data.report.warningCount === 0) {
      xp += 50; coins += 25; updatePlayer();
      log("MISSION CLEAR! Clean scan achieved. Bonus +50 XP and +25 coins.");
      toast("BOSS DEFEATED! Code is clean.");
    } else if (fixed > 0) {
      toast(`${fixed} fixable issue(s) processed. Review what remains.`);
    } else {
      toast("No safe autofixes available. Manual review needed.");
    }
  } catch(err) { toast(err.message); log("Attack failed: " + err.message); }
  finally {
    setTimeout(() => $("monster").classList.remove("hit"), 250);
    setBusy(false);
    $("attackBtn").disabled = !currentFiles.length || !currentReport || (currentReport.errorCount + currentReport.warningCount === 0);
  }
});
$("downloadBtn").addEventListener("click", async () => {
  if (!currentFiles.length) return;
  for (const name of currentFiles) {
    const link = document.createElement("a");
    link.href = "/api/download/" + encodeURIComponent(name);
    link.download = name;
    document.body.append(link); link.click(); link.remove();
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  log("Download requested for updated source file(s).");
  toast("Your updated code download has started.");
});
updatePlayer();
log("Game initialized. Load demo code or upload your JavaScript.");
