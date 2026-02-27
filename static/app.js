// ── ELEMENT REFS ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusEl       = $("status");
const btn            = $("generate");
const previewGrid    = $("preview-grid");
const downloadBtn    = $("download-btn");
const clearBtn       = $("clear-btn");
const widthInput     = $("width");
const heightInput    = $("height");
const aspectSelect   = $("aspect_ratio_preset");
const progressWrap   = $("progress-wrap");
const progressFill   = $("progress-fill");
const progressText   = $("progress-text");
const promptEl       = $("prompt");
const promptCounter  = $("prompt-counter");
const historyBtn     = $("history-btn");
const historyList    = $("history-dropdown");
const themeToggle    = $("theme-toggle");
const toastContainer = $("toast-container");

let progressTimer  = null;
let progressValue  = 0;
let generatedTiles = [];   // { blob, seed }[]

// ── CONSTANTS ────────────────────────────────────────────────────────
const MANUAL_MIN  = 256;
const PRESET_MIN  = 1024;
const MAX_SIZE    = 1536;
const STEP        = 16;
const HISTORY_MAX = 8;

const PLACEHOLDER_HTML = `
  <div class="ph">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="ph-icon">
      <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="20" r="4" stroke="currentColor" stroke-width="2"/>
      <path d="M4 34 l10-10 8 8 6-6 16 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Your generated image will appear here.</span>
    <small>Tip: press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to generate</small>
  </div>`;

const RATIOS = {
  "1:1":  [1, 1],
  "4:3":  [4, 3],
  "3:4":  [3, 4],
  "16:9": [16, 9],
  "9:16": [9, 16],
  "3:2":  [3, 2],
  "2:3":  [2, 3],
};

// ── THEME ────────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem("tonai_theme");
  const preferred = "dark"; // Default to dark theme
  document.documentElement.setAttribute("data-theme", saved || preferred);
})();

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("tonai_theme", next);
});

// ── TOAST ────────────────────────────────────────────────────────────
function showToast(message, type = "default", duration = 3200) {
  const el = document.createElement("div");
  el.className = "toast" + (type !== "default" ? ` toast-${type}` : "");
  const dot = document.createElement("span");
  dot.className = "toast-dot";
  el.append(dot, message);
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("fade-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, duration);
}

// ── STATUS ───────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.className = "status" + (type ? ` ${type}` : "");
}

// ── SIZE HELPERS ─────────────────────────────────────────────────────
function snap(value, minSize = MANUAL_MIN) {
  const clamped = Math.max(minSize, Math.min(MAX_SIZE, Math.round(Number(value))));
  return Math.max(minSize, Math.min(MAX_SIZE, Math.round(clamped / STEP) * STEP));
}

function applyRatio(key) {
  const ratio = RATIOS[key];
  if (!ratio) return;
  const [rw, rh] = ratio;
  const fw = rw >= rh ? (PRESET_MIN * rw) / rh : PRESET_MIN;
  const fh = rw >= rh ? PRESET_MIN : (PRESET_MIN * rh) / rw;
  widthInput.value  = String(snap(fw, PRESET_MIN));
  heightInput.value = String(snap(fh, PRESET_MIN));
}

function normalizeInputs() {
  widthInput.value  = String(snap(widthInput.value));
  heightInput.value = String(snap(heightInput.value));
}

// ── ASPECT RATIO BUTTONS ─────────────────────────────────────────────
const ratioButtons = document.querySelectorAll(".ratio-btn");
let activeRatio = "1:1";

ratioButtons.forEach((b) => {
  b.addEventListener("click", () => {
    activeRatio = b.dataset.ratio;
    ratioButtons.forEach((x) => x.classList.toggle("active", x.dataset.ratio === activeRatio));
    aspectSelect.value = activeRatio;
    applyRatio(activeRatio);
  });
});

widthInput.addEventListener("change",  normalizeInputs);
heightInput.addEventListener("change", normalizeInputs);

// ── COUNT BUTTONS ─────────────────────────────────────────────────────
const countButtons = document.querySelectorAll(".count-btn");
let activeCount = 1;

countButtons.forEach((b) => {
  b.addEventListener("click", () => {
    activeCount = Number(b.dataset.count);
    countButtons.forEach((x) => x.classList.toggle("active", Number(x.dataset.count) === activeCount));
  });
});

// ── PROMPT CHARACTER COUNTER ─────────────────────────────────────────
const PROMPT_MAX = Number(promptEl.getAttribute("maxlength") || 500);

function updateCounter() {
  const len = promptEl.value.length;
  promptCounter.textContent = `${len} / ${PROMPT_MAX}`;
  promptCounter.className =
    len > PROMPT_MAX        ? "char-counter over" :
    len > PROMPT_MAX * 0.85 ? "char-counter warn" :
                              "char-counter";
}
promptEl.addEventListener("input", updateCounter);
updateCounter();

// ── EXAMPLE PROMPT CHIPS ─────────────────────────────────────────────
document.querySelectorAll(".ex-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptEl.value = chip.textContent.trim();
    updateCounter();
    promptEl.focus();
  });
});

// ── PROMPT HISTORY ───────────────────────────────────────────────────
// History is session-only; nothing is persisted to localStorage.
function loadHistory() { return []; }

function renderHistory() {
  const hist = loadHistory();
  if (!hist.length) { historyList.hidden = true; return; }
  historyList.innerHTML = "";
  hist.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    li.title = p;
    li.addEventListener("click", () => {
      promptEl.value = p;
      updateCounter();
      historyList.hidden = true;
    });
    historyList.appendChild(li);
  });
  // Clear history footer
  const footer = document.createElement("li");
  footer.className = "history-clear";
  footer.textContent = "Clear history";
  footer.addEventListener("click", (e) => { e.stopPropagation(); clearHistory(); });
  historyList.appendChild(footer);
  historyList.hidden = false;
}
historyBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!historyList.hidden) { historyList.hidden = true; return; }
  renderHistory();
});
document.addEventListener("click", (e) => {
  if (!historyList.contains(e.target) && e.target !== historyBtn) historyList.hidden = true;
});

// ── PROGRESS ─────────────────────────────────────────────────────────
function updateProgress(v) {
  progressValue = Math.max(0, Math.min(100, v));
  progressFill.style.width = progressValue + "%";
  progressText.textContent = Math.round(progressValue) + "%";
}
function startProgress(stepCount) {
  if (progressTimer) clearInterval(progressTimer);
  progressWrap.style.display = "block";
  updateProgress(2);
  const steps = Math.max(1, Number(stepCount) || 9);
  const estimatedMs = Math.max(8000, steps * 900);
  const increment = (92 - 2) / ((estimatedMs / 200));
  progressTimer = setInterval(() => {
    updateProgress(Math.min(92, progressValue + increment));
  }, 200);
}
function finishProgress(success) {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  if (!success) { progressWrap.style.display = "none"; updateProgress(0); return; }
  updateProgress(100);
  setTimeout(() => { progressWrap.style.display = "none"; updateProgress(0); }, 450);
}

// ── DOWNLOAD HELPERS ─────────────────────────────────────────────────
function downloadBlob(blob, seed) {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tonai_${seed ?? "image"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

downloadBtn.addEventListener("click", () => {
  if (!generatedTiles.length) { showToast("No images to download.", "error"); return; }
  generatedTiles.forEach(({ blob, seed }, i) => {
    setTimeout(() => downloadBlob(blob, seed ?? `image_${i + 1}`), i * 250);
  });
});

// ── CLEAR OUTPUT ─────────────────────────────────────────────────────
function clearOutput() {
  previewGrid.innerHTML = PLACEHOLDER_HTML;
  previewGrid.classList.remove("has-images", "cols-2");
  generatedTiles = [];
  downloadBtn.disabled = true;
  clearBtn.disabled    = true;
}

clearBtn.addEventListener("click", clearOutput);

// ── RENDER TILES ─────────────────────────────────────────────────────
function renderTiles(tiles) {
  previewGrid.innerHTML = "";
  previewGrid.classList.add("has-images");
  previewGrid.classList.toggle("cols-2", tiles.length > 1);

  tiles.forEach(({ blob, seed }, i) => {
    const url = URL.createObjectURL(blob);

    const tile    = document.createElement("div");
    tile.className = "img-tile";

    const img = new Image();
    img.src = url;
    img.alt = `Generated image ${i + 1}`;
    img.onload = () => URL.revokeObjectURL(url);

    const footer = document.createElement("div");
    footer.className = "tile-footer";

    const seedSpan = document.createElement("span");
    seedSpan.className = "tile-seed";
    seedSpan.textContent = `Seed: ${seed ?? "—"}`;

    const dlBtn = document.createElement("button");
    dlBtn.className = "tile-dl-btn";
    dlBtn.title = "Download this image";
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    dlBtn.addEventListener("click", () => downloadBlob(blob, seed ?? `image_${i + 1}`));

    footer.append(seedSpan, dlBtn);
    tile.append(img, footer);
    previewGrid.appendChild(tile);
  });
}

// ── FETCH ONE IMAGE ───────────────────────────────────────────────────
async function fetchImage(payload) {
  const res = await fetch("/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "Request failed.";
    try { const err = await res.json(); detail = err.detail || JSON.stringify(err); } catch (_) {}
    throw new Error(detail);
  }
  const blob = await res.blob();
  const seedHeader = res.headers.get("X-Used-Seed");
  return { blob, seed: seedHeader !== null ? Number(seedHeader) : null };
}

// ── GENERATE ─────────────────────────────────────────────────────────
async function generate() {
  normalizeInputs();

  const baseSeed = Number($("seed").value);
  const basePayload = {
    prompt:              promptEl.value.trim(),
    negative_prompt:     $("negative_prompt").value,
    width:               Number(widthInput.value),
    height:              Number(heightInput.value),
    num_inference_steps: Number($("steps").value),
    guidance_scale:      Number($("guidance").value),
    seed:                baseSeed,
    model:               $("model").value,
  };

  if (!basePayload.prompt) {
    showToast("Please enter a prompt first.", "error");
    promptEl.focus();
    return;
  }

  // Build per-image seeds: random (-1) stays -1 for all; explicit seeds increment
  const seeds = Array.from({ length: activeCount }, (_, i) =>
    baseSeed === -1 ? -1 : baseSeed + i
  );

  btn.disabled = true;
  const label = activeCount > 1 ? `Generating ${activeCount} images…` : "Generating…";
  setStatus(label);
  startProgress(basePayload.num_inference_steps);

  let anySuccess = false;
  try {
    const results = await Promise.allSettled(
      seeds.map((seed) => fetchImage({ ...basePayload, seed }))
    );

    const tiles = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const errors = results.filter((r) => r.status === "rejected");

    if (tiles.length > 0) {
      generatedTiles = tiles;
      renderTiles(tiles);
      downloadBtn.disabled = false;
      clearBtn.disabled    = false;
      anySuccess = true;
    }

    if (errors.length > 0 && tiles.length === 0) {
      throw new Error(errors[0].reason?.message || "All requests failed.");
    }

    const msg = tiles.length === 1
      ? "Image generated!"
      : `${tiles.length} of ${activeCount} images generated!`;
    setStatus(msg.replace("!", "."), "success");
    showToast(msg, "success");
    setTimeout(() => setStatus(""), 3500);

    if (errors.length > 0) {
      showToast(`${errors.length} image(s) failed.`, "error");
    }
  } catch (err) {
    setStatus(err.message || "Unexpected error.", "error");
    showToast(err.message || "Generation failed.", "error");
  } finally {
    finishProgress(anySuccess);
    btn.disabled = false;
  }
}

btn.addEventListener("click", generate);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !btn.disabled) {
    e.preventDefault();
    generate();
  }
});

// ── INIT ─────────────────────────────────────────────────────────────
applyRatio(activeRatio);
