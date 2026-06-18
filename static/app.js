const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const generateBtn = $("generate");
const generateLabel = $("generate-label");
const previewGrid = $("preview-grid");
const downloadBtn = $("download-btn");
const clearBtn = $("clear-btn");
const widthInput = $("width");
const heightInput = $("height");
const aspectSelect = $("aspect_ratio_preset");
const promptEl = $("prompt");
const promptCounter = $("prompt-counter");
const themeToggle = $("theme-toggle");
const toastContainer = $("toast-container");
const sourceField = $("source-field");
const sourceInput = $("source-image");
const sourcePreview = $("source-preview");
const uploadEmpty = $("upload-empty");
const uploadZone = $("upload-zone");
const removeSourceBtn = $("remove-source");
const textSettings = $("text-settings");
const editSettings = $("edit-settings");
const guidanceField = $("guidance-field");
const trueCfgField = $("true-cfg-field");
const modeChip = $("mode-chip");
const outputTitle = $("output-title");
const outputSubtitle = $("output-subtitle");
const examplesEl = document.querySelector(".example-prompts");

let currentMode = "text";
let generatedTile = null;
let sourceObjectUrls = [];
let textPromptExamples = [];

const MANUAL_MIN = 256;
const PRESET_MIN = 1024;
const MAX_SIZE = 1536;
const STEP = 16;

const RATIOS = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "16:9": [16, 9],
  "9:16": [9, 16],
  "3:2": [3, 2],
  "2:3": [2, 3],
};

const MODE_CONFIG = {
  text: {
    title: "Text to Image",
    subtitle: "Generated image",
    action: "Generate",
    prompt: "A cinematic portrait of a jazz pianist in a small club, warm stage light, 35mm film grain",
    steps: 9,
    examples: [],
  },
  image: {
    title: "Image to Image",
    subtitle: "Edited image",
    action: "Edit Image",
    prompt: "Change the background to a dramatic studio scene while preserving the main subject",
    steps: 50,
    examples: [],
  },
};

const PLACEHOLDER_HTML = `
  <div class="placeholder">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="placeholder-icon" aria-hidden="true">
      <rect x="5" y="8" width="38" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
      <circle cx="17" cy="20" r="4" stroke="currentColor" stroke-width="2"/>
      <path d="M6 35l10-10 8 8 6-6 12 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>No image yet</span>
  </div>`;

function initTheme() {
  const saved = localStorage.getItem("tonai_theme");
  document.documentElement.setAttribute("data-theme", saved || "dark");
}

initTheme();

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("tonai_theme", next);
});

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

function setStatus(message, type = "") {
  statusEl.textContent = message || "";
  statusEl.className = "status" + (type ? ` ${type}` : "");
}

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
  widthInput.value = String(snap(fw, PRESET_MIN));
  heightInput.value = String(snap(fh, PRESET_MIN));
}

function normalizeTextInputs() {
  widthInput.value = String(snap(widthInput.value));
  heightInput.value = String(snap(heightInput.value));
}

document.querySelectorAll(".ratio-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const activeRatio = button.dataset.ratio;
    document.querySelectorAll(".ratio-btn").forEach((item) => {
      item.classList.toggle("active", item.dataset.ratio === activeRatio);
    });
    aspectSelect.value = activeRatio;
    applyRatio(activeRatio);
  });
});

widthInput.addEventListener("change", normalizeTextInputs);
heightInput.addEventListener("change", normalizeTextInputs);

function updateCounter() {
  const max = Number(promptEl.getAttribute("maxlength") || 700);
  const len = promptEl.value.length;
  promptCounter.textContent = `${len} / ${max}`;
  promptCounter.className =
    len > max ? "char-counter over" :
    len > max * 0.85 ? "char-counter warn" :
    "char-counter";
}

promptEl.addEventListener("input", updateCounter);

function renderExamples() {
  const config = MODE_CONFIG[currentMode];
  const examples = currentMode === "text" ? textPromptExamples : config.examples;
  examplesEl.innerHTML = "";
  examplesEl.classList.toggle("hidden", examples.length === 0);

  examples.slice(0, 4).forEach((promptText) => {
    const chip = document.createElement("button");
    chip.className = "example-chip";
    chip.type = "button";
    chip.textContent = promptText;
    chip.addEventListener("click", () => {
      promptEl.value = promptText;
      updateCounter();
      promptEl.focus();
    });
    examplesEl.appendChild(chip);
  });
}

fetch("/static/prompts.json")
  .then((res) => res.json())
  .then((prompts) => {
    textPromptExamples = Array.isArray(prompts) ? prompts : [];
    MODE_CONFIG.text.examples = textPromptExamples;
    renderExamples();
  })
  .catch(() => {
    textPromptExamples = [
      "Editorial fashion portrait in a minimalist studio, soft side lighting, crisp details",
      "A wooden cabin beside a frozen alpine lake at sunrise, warm window light, mist",
    ];
    renderExamples();
  });

function setMode(mode) {
  currentMode = mode;
  const config = MODE_CONFIG[mode];

  document.body.dataset.mode = mode;
  document.querySelectorAll(".mode-tab").forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  sourceField.classList.toggle("hidden", mode !== "image");
  textSettings.classList.toggle("hidden", mode !== "text");
  editSettings.classList.toggle("hidden", mode !== "image");
  guidanceField.classList.toggle("hidden", mode !== "text");
  trueCfgField.classList.toggle("hidden", mode !== "image");

  modeChip.textContent = config.title;
  outputTitle.textContent = config.title;
  outputSubtitle.textContent = config.subtitle;
  generateLabel.textContent = config.action;
  promptEl.placeholder = config.prompt;

  $("steps").value = String(config.steps);
  setStatus("");
  renderExamples();
}

document.querySelectorAll(".mode-tab").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

function resetSourcePreview() {
  sourceObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  sourceObjectUrls = [];
  sourceInput.value = "";
  sourcePreview.hidden = true;
  sourcePreview.replaceChildren();
  uploadEmpty.hidden = false;
  uploadZone.classList.remove("has-source");
  removeSourceBtn.disabled = true;
}

function setSourceFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, 2);
  if (!files.length || files.some((file) => !file.type.startsWith("image/"))) {
    showToast("Choose an image file.", "error");
    return;
  }

  if ((fileList?.length || 0) > 2) {
    showToast("Using the first 2 images.");
  }

  sourceObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  sourceObjectUrls = files.map((file) => URL.createObjectURL(file));
  sourcePreview.replaceChildren();

  sourceObjectUrls.forEach((url, index) => {
    const img = new Image();
    img.src = url;
    img.alt = `Source image ${index + 1} preview`;
    sourcePreview.appendChild(img);
  });

  if (files.length !== sourceInput.files?.length) {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    sourceInput.files = transfer.files;
  }

  sourcePreview.hidden = false;
  uploadEmpty.hidden = true;
  uploadZone.classList.add("has-source");
  removeSourceBtn.disabled = false;
}

sourceInput.addEventListener("change", () => {
  setSourceFiles(sourceInput.files);
});

removeSourceBtn.addEventListener("click", resetSourcePreview);

["dragenter", "dragover"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
});

uploadZone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files || []).slice(0, 2);
  if (!files.length) return;

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  sourceInput.files = transfer.files;
  setSourceFiles(sourceInput.files);
});

function downloadBlob(blob, seed) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tonai_${currentMode}_${seed ?? "image"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

downloadBtn.addEventListener("click", () => {
  if (!generatedTile) {
    showToast("No image to download.", "error");
    return;
  }
  downloadBlob(generatedTile.blob, generatedTile.seed);
});

function clearOutput() {
  previewGrid.innerHTML = PLACEHOLDER_HTML;
  previewGrid.classList.remove("has-image");
  generatedTile = null;
  downloadBtn.disabled = true;
  clearBtn.disabled = true;
}

clearBtn.addEventListener("click", clearOutput);

function renderResult(tile) {
  const url = URL.createObjectURL(tile.blob);
  previewGrid.innerHTML = "";
  previewGrid.classList.add("has-image");

  const imageTile = document.createElement("div");
  imageTile.className = "image-tile";

  const img = new Image();
  img.src = url;
  img.alt = currentMode === "image" ? "Edited image" : "Generated image";
  img.onload = () => URL.revokeObjectURL(url);

  const footer = document.createElement("div");
  footer.className = "tile-footer";

  const seed = document.createElement("span");
  seed.textContent = `Seed ${tile.seed ?? "-"}`;

  const button = document.createElement("button");
  button.className = "tile-download";
  button.type = "button";
  button.title = "Download image";
  button.setAttribute("aria-label", "Download image");
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`;
  button.addEventListener("click", () => downloadBlob(tile.blob, tile.seed));

  footer.append(seed, button);
  imageTile.append(img, footer);
  previewGrid.appendChild(imageTile);
}

async function readImageResponse(res) {
  if (!res.ok) {
    let detail = "Request failed.";
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch (_) {}
    throw new Error(detail);
  }

  const blob = await res.blob();
  const seedHeader = res.headers.get("X-Used-Seed");
  return { blob, seed: seedHeader !== null ? Number(seedHeader) : null };
}

async function fetchTextImage() {
  normalizeTextInputs();

  const payload = {
    prompt: promptEl.value.trim(),
    negative_prompt: "",
    width: Number(widthInput.value),
    height: Number(heightInput.value),
    num_inference_steps: Number($("steps").value),
    guidance_scale: Number($("guidance").value),
    seed: Number($("seed").value),
    model: $("model").value,
  };

  const res = await fetch("/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readImageResponse(res);
}

async function fetchEditedImage() {
  const files = Array.from(sourceInput.files || []).slice(0, 2);
  if (!files.length) {
    throw new Error("Choose a source image.");
  }

  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  form.append("prompt", promptEl.value.trim());
  form.append("negative_prompt", " ");
  form.append("num_inference_steps", String(Number($("steps").value)));
  form.append("true_cfg_scale", String(Number($("true-cfg").value)));
  form.append("seed", String(Number($("seed").value)));
  form.append("model", $("edit-model").value);

  const res = await fetch("/edit/image", {
    method: "POST",
    body: form,
  });

  return readImageResponse(res);
}

async function runImageJob() {
  if (!promptEl.value.trim()) {
    showToast("Enter a prompt.", "error");
    promptEl.focus();
    return;
  }

  if (currentMode === "image" && !sourceInput.files?.[0]) {
    showToast("Choose a source image.", "error");
    sourceInput.focus();
    return;
  }

  generateBtn.disabled = true;
  setStatus(currentMode === "image" ? "Editing image..." : "Generating image...");

  try {
    const tile = currentMode === "image" ? await fetchEditedImage() : await fetchTextImage();
    generatedTile = tile;
    renderResult(tile);
    downloadBtn.disabled = false;
    clearBtn.disabled = false;
    setStatus(currentMode === "image" ? "Image edited." : "Image generated.", "success");
    showToast(currentMode === "image" ? "Image edited." : "Image generated.", "success");
    setTimeout(() => setStatus(""), 3500);
  } catch (err) {
    const message = err.message || "Image request failed.";
    setStatus(message, "error");
    showToast(message, "error");
  } finally {
    generateBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", runImageJob);

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !generateBtn.disabled) {
    event.preventDefault();
    runImageJob();
  }
});

applyRatio("1:1");
updateCounter();
setMode("text");
