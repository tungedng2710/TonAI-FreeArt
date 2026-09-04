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
const examplesPanel = $("examples-panel");
const examplesEl = document.querySelector(".example-prompts");
const imageCountInput = $("image-count");
const imageCountValue = $("image-count-value");

let currentMode = "text";
let generatedTiles = [];
let sourceObjectUrls = [];
const textPromptExamples = [
  {
    title: "Ivory Editorial",
    category: "Person",
    image: "/static/examples/woman-editorial.webp",
    prompt: "Editorial portrait of a poised Vietnamese woman in a sculptural ivory silk ao dai with subtle pearl embroidery, standing beneath curved brutalist concrete arches after rain; reflective courtyard, distant tropical foliage and faint mist; photorealistic luxury fashion editorial with natural skin texture and refined magazine color grading; square waist-up three-quarter pose, 85mm lens, shallow depth of field; soft overcast daylight with a warm rim light; ivory, cool concrete gray and muted jade palette.",
  },
  {
    title: "Neon Monsoon",
    category: "Person",
    image: "/static/examples/woman-neon.webp",
    prompt: "Cinematic portrait of an adult East Asian woman with a sharp bob haircut wearing layered charcoal streetwear and a translucent raincoat in a neon-lit night market; rain-slick alley, steam drifting from food stalls and abstract out-of-focus signs; photorealistic 35mm street-fashion photography with fine film grain; square dynamic chest-up angle, subject slightly off-center, shallow depth of field; cyan and magenta reflections with soft tungsten highlights; energetic yet introspective mood.",
  },
  {
    title: "Cobalt Couture",
    category: "Person",
    image: "/static/examples/woman-couture.webp",
    prompt: "High-fashion portrait of an adult Black woman in an architectural cobalt couture gown with pleated shoulders and brushed silver jewelry; vast minimalist gallery with pale stone walls and a single geometric sculpture; photorealistic museum-quality fashion campaign with crisp textile detail; square full three-quarter figure in a symmetrical editorial composition, medium-format camera look; dramatic skylight creating long clean shadows; cobalt blue, limestone, silver and deep umber palette.",
  },
  {
    title: "Wildflower Light",
    category: "Person",
    image: "/static/examples/woman-sunlight.webp",
    prompt: "Intimate lifestyle portrait of an adult South Asian woman in a rust linen dress arranging wildflowers beside an open window in an old artist studio; limewashed walls, ceramic vessels, moving linen curtains and visible dust motes; photorealistic analog editorial photography with tactile natural textures; square candid waist-up composition, 50mm lens, foreground flowers framing the subject; late-afternoon honeyed sunlight; warm, quiet and contemplative terracotta, ochre, cream and dusty-green palette.",
  },
  {
    title: "Cliff House",
    category: "Architecture",
    image: "/static/examples/cliff-house.webp",
    prompt: "A cantilevered concrete house embedded into a windswept Atlantic cliff, warm interior light glowing through panoramic glass; black rock coast, churning sea far below, low storm clouds and thin rain; photorealistic architectural visualization with cinematic realism; square aerial three-quarter view emphasizing scale, structure and geometry; blue-hour storm light contrasted with amber interiors; slate blue, wet charcoal and warm gold palette; plausible engineering, weathered materials, no people.",
  },
  {
    title: "Fox Astronomer",
    category: "Wildlife",
    image: "/static/examples/fox-library.webp",
    prompt: "Photorealistic cinematic wildlife photograph of a real small red fox appearing to study an open constellation atlas inside an ancient circular observatory library; towering walnut bookshelves, brass orrery, spiral stairs and a domed ceiling open to a star-filled sky; lifelike fur, natural anatomy, realistic wood, brass and paper textures; square composition with the fox at a desk in the lower center and sweeping shelves forming a circular frame; practical candlelight mixed with cool starlight; magical yet physically plausible midnight-blue, copper and warm-gold palette; no clothes or human-like features.",
  },
  {
    title: "Midnight Ramen",
    category: "Food",
    image: "/static/examples/ramen-still-life.webp",
    prompt: "Elevated overhead food photograph of handmade miso ramen with charred corn, soft egg, shiitake mushrooms, scallions, chili oil and crisp nori; dark walnut table with a folded indigo napkin, chopsticks and tiny ceramic condiment dishes; photorealistic premium restaurant campaign photography with authentic food texture; square top-down flat lay with balanced asymmetry and subtle negative space; soft directional window light; lacquer black, amber broth, yolk gold, deep green and indigo palette.",
  },
  {
    title: "Two-Moon Rover",
    category: "Sci-fi",
    image: "/static/examples/desert-rover.webp",
    prompt: "Photorealistic cinematic space-mission photograph of a compact solar exploration rover crossing a vast red desert beneath two pale moons while a distant crystalline dust storm rises; layered sandstone mesas, rippled dunes and scattered black volcanic glass; physically plausible engineering, weathered machinery, natural optics and realistic atmospheric depth; square wide-angle low viewpoint, rover in the lower third beneath a monumental sky; cold dawn light with long violet shadows; lonely, exploratory and awe-inspiring rust-red, pale-cyan and matte-white palette.",
  },
  {
    title: "Rainforest Jewel",
    category: "Wildlife",
    image: "/static/examples/glass-frog.webp",
    prompt: "Photorealistic macro photograph of a translucent glass frog perched on a rain-covered emerald leaf, tiny toes gripping the edge; cloud-forest understory dissolving into creamy bokeh with suspended droplets; scientifically accurate wildlife photography with exquisite natural micro-detail; square extreme close-up at eye level, frog centered on a diagonal leaf line; diffused rainforest light with luminous backlighting through the leaf; delicate and mysterious emerald, lime, translucent mint and silver palette.",
  },
  {
    title: "Last Set",
    category: "Music",
    image: "/static/examples/jazz-cellar.webp",
    prompt: "Photorealistic cinematic documentary photograph of an elderly jazz pianist performing alone in a tiny underground club as the last audience members listen in silence; worn upright piano, brick cellar walls, small round tables and faint stage haze; authentic 35mm film grain, natural skin and aged material textures; square intimate side view, pianist and keyboard forming a diagonal, listeners softly blurred behind; a single warm spotlight against deep blue ambient shadows; soulful tobacco-brown, brass-gold and burgundy palette.",
  },
];

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
    subtitle: "Generated images",
    action: "Generate",
    prompt: "A cinematic portrait of a jazz pianist in a small club, warm stage light, 35mm film grain",
    steps: 20,
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
  document.documentElement.setAttribute("data-theme", saved || "light");
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
  let fw = rw >= rh ? (PRESET_MIN * rw) / rh : PRESET_MIN;
  let fh = rw >= rh ? PRESET_MIN : (PRESET_MIN * rh) / rw;
  const scale = Math.min(1, MAX_SIZE / Math.max(fw, fh));

  fw *= scale;
  fh *= scale;
  widthInput.value = String(snap(fw));
  heightInput.value = String(snap(fh));
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

function updateImageCountSlider() {
  const value = Number(imageCountInput.value);
  const minimum = Number(imageCountInput.min);
  const maximum = Number(imageCountInput.max);
  const progress = ((value - minimum) / (maximum - minimum)) * 100;
  imageCountInput.style.setProperty("--range-progress", `${progress}%`);
  imageCountInput.setAttribute("aria-valuetext", `${value} ${value === 1 ? "image" : "images"}`);
  imageCountValue.value = String(value);
  imageCountValue.textContent = String(value);
}

imageCountInput.addEventListener("input", updateImageCountSlider);

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
  examplesPanel.classList.toggle("hidden", examples.length === 0);

  examples.forEach((example) => {
    const card = document.createElement("button");
    card.className = "example-card";
    card.type = "button";
    card.title = example.prompt;
    card.setAttribute("aria-label", `Use ${example.title} example prompt`);

    const image = new Image();
    image.className = "example-card-image";
    image.src = example.image;
    image.alt = "";
    image.loading = "lazy";

    const caption = document.createElement("span");
    caption.className = "example-card-caption";
    const category = document.createElement("span");
    category.className = "example-card-category";
    category.textContent = example.category;
    const title = document.createElement("span");
    title.className = "example-card-title";
    title.textContent = example.title;
    caption.append(category, title);

    card.append(image, caption);
    card.addEventListener("click", () => {
      promptEl.value = example.prompt;
      updateCounter();
      promptEl.focus();
      showToast(`Loaded “${example.title}” prompt.`, "success", 2200);
    });
    examplesEl.appendChild(card);
  });
}

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

function downloadBlob(blob, seed, index = 0) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const suffix = generatedTiles.length > 1 ? `_${index + 1}` : "";
  link.download = `tonai_${currentMode}_${seed ?? "image"}${suffix}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

downloadBtn.addEventListener("click", () => {
  if (!generatedTiles.length) {
    showToast("No image to download.", "error");
    return;
  }
  generatedTiles.forEach((tile, index) => downloadBlob(tile.blob, tile.seed, index));
});

function clearOutput() {
  previewGrid.innerHTML = PLACEHOLDER_HTML;
  previewGrid.classList.remove("has-image", "multi-image");
  generatedTiles = [];
  downloadBtn.disabled = true;
  clearBtn.disabled = true;
}

clearBtn.addEventListener("click", clearOutput);

function renderResults(tiles) {
  previewGrid.innerHTML = "";
  previewGrid.classList.add("has-image");
  previewGrid.classList.toggle("multi-image", tiles.length > 1);

  tiles.forEach((tile, index) => {
    const url = URL.createObjectURL(tile.blob);
    const imageTile = document.createElement("div");
    imageTile.className = "image-tile";

    const img = new Image();
    img.src = url;
    img.alt = currentMode === "image" ? "Edited image" : `Generated image ${index + 1}`;
    img.onload = () => URL.revokeObjectURL(url);

    const footer = document.createElement("div");
    footer.className = "tile-footer";

    const seed = document.createElement("span");
    const imageLabel = tiles.length > 1 ? ` · Image ${index + 1}` : "";
    seed.textContent = `Seed ${tile.seed ?? "-"}${imageLabel}`;

    const button = document.createElement("button");
    button.className = "tile-download";
    button.type = "button";
    button.title = "Download image";
    button.setAttribute("aria-label", `Download image ${index + 1}`);
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`;
    button.addEventListener("click", () => downloadBlob(tile.blob, tile.seed, index));

    footer.append(seed, button);
    imageTile.append(img, footer);
    previewGrid.appendChild(imageTile);
  });
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

function base64ToBlob(encoded, mimeType = "image/png") {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function readImagesResponse(res) {
  if (!res.ok) {
    let detail = "Request failed.";
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch (_) {}
    throw new Error(detail);
  }

  const result = await res.json();
  const encodedImages = result.images_base64?.length
    ? result.images_base64
    : [result.image_base64].filter(Boolean);
  if (!encodedImages.length) {
    throw new Error("No images were returned.");
  }
  return encodedImages.map((encoded) => ({
    blob: base64ToBlob(encoded, result.mime_type),
    seed: result.seed,
  }));
}

async function fetchTextImages() {
  normalizeTextInputs();

  const payload = {
    prompt: promptEl.value.trim(),
    negative_prompt: "",
    width: Number(widthInput.value),
    height: Number(heightInput.value),
    num_inference_steps: Number($("steps").value),
    true_cfg_scale: 4.0,
    guidance_scale: Number($("guidance").value),
    seed: Number($("seed").value),
    model: $("model").value,
    n: Number($("image-count").value),
  };

  const res = await fetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readImagesResponse(res);
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
    const tiles = currentMode === "image"
      ? [await fetchEditedImage()]
      : await fetchTextImages();
    generatedTiles = tiles;
    renderResults(tiles);
    downloadBtn.disabled = false;
    clearBtn.disabled = false;
    const successMessage = currentMode === "image"
      ? "Image edited."
      : `${tiles.length} ${tiles.length === 1 ? "image" : "images"} generated.`;
    setStatus(successMessage, "success");
    showToast(successMessage, "success");
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
updateImageCountSlider();
updateCounter();
setMode("text");
