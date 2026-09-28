const bouncer = document.getElementById('bouncer');
const pickButton = document.getElementById('pickBtn');
const clearButton = document.getElementById('clearBtn');
const fileInput = document.getElementById('fileInput');
const fx = document.getElementById('fx');
const fxContext = fx.getContext('2d');
const trail = document.getElementById('trail');
const trailContext = trail.getContext('2d');
const flash = document.getElementById('flash');
const cornerText = document.getElementById('cornerText');
const countdown = document.getElementById('countdown');
const countdownLabel = document.getElementById('countdownLabel');
const countdownTime = document.getElementById('countdownTime');
const crtOverlay = document.getElementById('crtOverlay');
const bgBadge = document.getElementById('bgBadge');
const tvFrame = document.getElementById('tvFrame');
const screenElement = document.getElementById('screen');

const settingsButton = document.getElementById('settingsBtn');
const trailPanel = document.getElementById('trailControls');
const paletteButton = document.getElementById('paletteButton');
const paletteButtonSwatch = document.getElementById('paletteButtonSwatch');
const paletteButtonLabel = document.getElementById('paletteButtonLabel');
const paletteList = document.getElementById('paletteList');
const backgroundColorInput = document.getElementById('backgroundColor');
const backgroundBadgeInput = document.getElementById('backgroundBadge');
const frameEnabledInput = document.getElementById('frameEnabled');
const tvPhotoWrap = document.getElementById('tvPhotoWrap');
const soundEnabledInput = document.getElementById('soundEnabled');
const countdownEnabledInput = document.getElementById('countdownEnabled');
const crtEnabledInput = document.getElementById('crtEnabled');
const crtIntensityInput = document.getElementById('crtIntensity');
const crtIntensityValue = document.getElementById('crtIntensityVal');
const trailEnabledInput = document.getElementById('trailEnabled');
const trailStyleInput = document.getElementById('trailStyle');
const trailSpeedInput = document.getElementById('trailSpeed');
const trailSpeedValue = document.getElementById('trailSpeedVal');
const trailSizeInput = document.getElementById('trailSize');
const trailSizeValue = document.getElementById('trailSizeVal');
const trailFadeInput = document.getElementById('trailFade');
const trailFadeValue = document.getElementById('trailFadeVal');
const trailOpacityInput = document.getElementById('trailOpacity');
const trailOpacityValue = document.getElementById('trailOpacityVal');

// Premade palettes, ordered dark to bright.
const PALETTES = {
  midnight: ['#1b1f3b', '#2e1a47', '#3a1c71', '#4b1248', '#5c2a4d', '#3d3b6b', '#1f4068'],
  classic: [
    '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
    '#00c7be', '#30b0c7', '#007aff', '#5856d6',
    '#af52de', '#ff2d55'
  ],
  vivid: ['#ff0040', '#ff8c00', '#ffe600', '#00ff85', '#00e5ff', '#0080ff', '#8000ff', '#ff00d4'],
  neon: ['#ff00ff', '#00ffff', '#ffff00', '#39ff14', '#ff073a', '#0aefff', '#f4ff00']
};
const DEFAULT_PALETTE = 'classic';

function loadPalette() {
  try {
    const saved = localStorage.getItem('cornerWatchPalette');
    if (saved && PALETTES[saved]) return saved;
  } catch {}
  return DEFAULT_PALETTE;
}

function savePalette(name) {
  try { localStorage.setItem('cornerWatchPalette', name); } catch {}
}

let paletteName = loadPalette();
let colors = PALETTES[paletteName];

const PALETTE_LABELS = { midnight: 'Midnight', classic: 'Classic', vivid: 'Vivid', neon: 'Neon' };

// A native <select> can't preview a palette's colors, so the picker is a
// small custom button + listbox instead, each row showing a swatch strip
// (a hard-stop gradient built from that palette's own colors) next to its
// name.
function swatchGradient(paletteColors) {
  const stops = paletteColors.map((color, index) => {
    const from = (index / paletteColors.length) * 100;
    const to = ((index + 1) / paletteColors.length) * 100;
    return `${color} ${from}% ${to}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function selectPalette(name) {
  paletteName = name;
  colors = PALETTES[name];
  paletteButtonSwatch.style.background = swatchGradient(colors);
  paletteButtonLabel.textContent = PALETTE_LABELS[name];
  for (const item of paletteList.children) {
    item.setAttribute('aria-selected', String(item.dataset.palette === name));
  }
}

for (const name of Object.keys(PALETTES)) {
  const item = document.createElement('li');
  item.dataset.palette = name;
  item.setAttribute('role', 'option');

  const swatch = document.createElement('span');
  swatch.className = 'swatchStrip';
  swatch.style.background = swatchGradient(PALETTES[name]);

  const label = document.createElement('span');
  label.textContent = PALETTE_LABELS[name];

  item.append(swatch, label);
  paletteList.append(item);
}

selectPalette(paletteName);

paletteButton.addEventListener('click', () => {
  const willShow = paletteList.hidden;
  paletteList.hidden = !willShow;
  paletteButton.setAttribute('aria-expanded', String(willShow));
});

paletteList.addEventListener('click', (event) => {
  const item = event.target.closest('li');
  if (!item) return;
  selectPalette(item.dataset.palette);
  savePalette(paletteName);
  setColor();
  paletteList.hidden = true;
  paletteButton.setAttribute('aria-expanded', 'false');
});

// The screen color and the corner badge are independent, toggleable
// choices (e.g. the classic solid-blue "no signal" screen still showing a
// tuned-in "CH 3" badge), not one combined preset.
const BACKGROUND_COLORS = { classic: null, blue90s: '#0000aa' };
const BADGE_TEXT = { none: null, video: 'VIDEO', ch3: 'CH 3', av1: 'AV 1' };
const DEFAULT_BACKGROUND_CONFIG = { color: 'classic', badge: 'none' };

function loadBackgroundConfig() {
  try {
    const raw = localStorage.getItem('cornerWatchBackground');
    if (raw) return Object.assign({}, DEFAULT_BACKGROUND_CONFIG, JSON.parse(raw));
  } catch {}
  return Object.assign({}, DEFAULT_BACKGROUND_CONFIG);
}

function saveBackgroundConfig() {
  try { localStorage.setItem('cornerWatchBackground', JSON.stringify(backgroundConfig)); } catch {}
}

function applyBackgroundConfig() {
  document.body.style.background = BACKGROUND_COLORS[backgroundConfig.color] || '';
  const text = BADGE_TEXT[backgroundConfig.badge];
  bgBadge.textContent = text || '';
  bgBadge.hidden = !text;
}

const backgroundConfig = loadBackgroundConfig();
backgroundColorInput.value = backgroundConfig.color;
backgroundBadgeInput.value = backgroundConfig.badge;
applyBackgroundConfig();

backgroundColorInput.addEventListener('change', () => {
  backgroundConfig.color = backgroundColorInput.value;
  applyBackgroundConfig();
  saveBackgroundConfig();
});

backgroundBadgeInput.addEventListener('change', () => {
  backgroundConfig.badge = backgroundBadgeInput.value;
  applyBackgroundConfig();
  saveBackgroundConfig();
});

const cornerPhrases = [
  'PERFECT CORNER HIT!',
  'NAILED IT!',
  'JACKPOT!',
  'IMPOSSIBLE ODDS!',
  'CORNER LEGEND!'
];

// Trail points are tracked as discrete points with a JS-computed alpha,
// not baked into canvas pixels, so they always fade to exactly zero
// instead of stalling faintly due to 8-bit alpha rounding. Aged in real ms
// (not frame count) so the fade takes the same wall-clock time regardless
// of the display's refresh rate. Everything else (on/off, style, size,
// fade duration, opacity, ball speed) is user-configurable below and
// persisted to localStorage.
const TRAIL_SAMPLE_INTERVAL = 2;
let trailPoints = [];
let trailFrameCounter = 0;

const DEFAULT_TRAIL_CONFIG = {
  enabled: false,
  style: 'dots',
  speed: 2,
  sizePct: 100,
  fadeSeconds: 45,
  opacityPct: 45
};

function loadTrailConfig() {
  try {
    const raw = localStorage.getItem('cornerWatchTrailConfig');
    if (raw) return Object.assign({}, DEFAULT_TRAIL_CONFIG, JSON.parse(raw));
  } catch {}
  return Object.assign({}, DEFAULT_TRAIL_CONFIG);
}

function saveTrailConfig() {
  try { localStorage.setItem('cornerWatchTrailConfig', JSON.stringify(trailConfig)); } catch {}
}

const trailConfig = loadTrailConfig();

// The HUD's range sliders are drawn as a filled block gauge (see
// styles.css), which needs the fill percentage as a CSS custom property
// since plain <input type="range"> exposes no "how full" pseudo-selector.
function updateRangeFill(input) {
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  const pct = ((Number.parseFloat(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--fill', pct + '%');
}

function syncTrailUI() {
  trailEnabledInput.checked = trailConfig.enabled;
  trailStyleInput.value = trailConfig.style;
  trailSpeedInput.value = trailConfig.speed;
  trailSpeedValue.textContent = trailConfig.speed + 'px';
  trailSizeInput.value = trailConfig.sizePct;
  trailSizeValue.textContent = trailConfig.sizePct + '%';
  trailFadeInput.value = trailConfig.fadeSeconds;
  trailFadeValue.textContent = trailConfig.fadeSeconds + 's';
  trailOpacityInput.value = trailConfig.opacityPct;
  trailOpacityValue.textContent = trailConfig.opacityPct + '%';
  for (const input of trailPanel.querySelectorAll('input[type="range"]')) {
    updateRangeFill(input);
  }
}
syncTrailUI();

// Any range slider inside the panel (trail or CRT) keeps its --fill custom
// property in sync through this one delegated listener, instead of every
// business-logic handler having to remember to call updateRangeFill itself.
trailPanel.addEventListener('input', (event) => {
  if (event.target.matches('input[type="range"]')) updateRangeFill(event.target);
});

// The panel starts collapsed on every load so the extra controls stay out
// of the way until someone asks for them.
settingsButton.addEventListener('click', () => {
  const willShow = trailPanel.hidden;
  trailPanel.hidden = !willShow;
  settingsButton.setAttribute('aria-expanded', String(willShow));
});

function loadCountdownVisible() {
  try {
    const raw = localStorage.getItem('cornerWatchCountdownVisible');
    if (raw !== null) return raw === 'true';
  } catch {}
  return true;
}

let countdownVisible = loadCountdownVisible();
countdownEnabledInput.checked = countdownVisible;
countdown.hidden = !countdownVisible;

countdownEnabledInput.addEventListener('change', () => {
  countdownVisible = countdownEnabledInput.checked;
  countdown.hidden = !countdownVisible;
  try { localStorage.setItem('cornerWatchCountdownVisible', String(countdownVisible)); } catch {}
});

// The time value is hidden behind a spoiler (like the countdown itself might
// be a bit of a spoiler for how the run ends) until clicked; clicking again
// re-hides it.
countdownTime.addEventListener('click', () => {
  countdownTime.classList.toggle('revealed');
});

function loadSoundEnabled() {
  try {
    const raw = localStorage.getItem('cornerWatchSoundEnabled');
    if (raw !== null) return raw === 'true';
  } catch {}
  return false;
}

let soundEnabled = loadSoundEnabled();
soundEnabledInput.checked = soundEnabled;

soundEnabledInput.addEventListener('change', () => {
  soundEnabled = soundEnabledInput.checked;
  try { localStorage.setItem('cornerWatchSoundEnabled', String(soundEnabled)); } catch {}
});

const DEFAULT_CRT_CONFIG = { enabled: false, intensity: 50 };
const CRT_MAX_OPACITY = 0.9;

function loadCrtConfig() {
  try {
    const raw = localStorage.getItem('cornerWatchCrtConfig');
    if (raw) return Object.assign({}, DEFAULT_CRT_CONFIG, JSON.parse(raw));
  } catch {}
  return Object.assign({}, DEFAULT_CRT_CONFIG);
}

function saveCrtConfig() {
  try { localStorage.setItem('cornerWatchCrtConfig', JSON.stringify(crtConfig)); } catch {}
}

const crtConfig = loadCrtConfig();

function applyCrtEffect() {
  crtOverlay.hidden = !crtConfig.enabled;
  document.documentElement.style.setProperty('--crt-intensity', (crtConfig.intensity / 100) * CRT_MAX_OPACITY);
}

crtEnabledInput.checked = crtConfig.enabled;
crtIntensityInput.value = crtConfig.intensity;
crtIntensityValue.textContent = crtConfig.intensity + '%';
updateRangeFill(crtIntensityInput);
applyCrtEffect();

crtEnabledInput.addEventListener('change', () => {
  crtConfig.enabled = crtEnabledInput.checked;
  applyCrtEffect();
  saveCrtConfig();
});

crtIntensityInput.addEventListener('input', () => {
  crtConfig.intensity = Number.parseInt(crtIntensityInput.value, 10);
  crtIntensityValue.textContent = crtConfig.intensity + '%';
  applyCrtEffect();
  saveCrtConfig();
});

function loadFrameEnabled() {
  try {
    const raw = localStorage.getItem('cornerWatchFrame');
    if (raw !== null) return raw === 'true';
  } catch {}
  return false;
}

function saveFrameEnabled() {
  try { localStorage.setItem('cornerWatchFrame', String(frameEnabled)); } catch {}
}

// #screen always renders at full logical viewport size (so every existing
// window.innerWidth/innerHeight-based calculation elsewhere keeps working
// unchanged); the "TV frame" view visually warps that whole rendered scene,
// via a projective (4-corner pin) transform, to sit inside the drawn
// chassis's screen cutout - which is a trapezoid, not a rectangle, because
// the photo was shot at an angle. Corners measured by hand against
// tv-cart.png's own screen position.
const screenCorners = {
  nw: { x: 25.5, y: 7.8 },
  ne: { x: 69.50342980514334, y: 8.32308750286536 },
  sw: { x: 25.77683036812331, y: 32.596328172213305 },
  se: { x: 68.62889781640294, y: 34.19676162293955 },
};

// Solves the 8-unknown projective transform mapping 4 source points to 4
// destination points (direct linear transform), via Gaussian elimination.
// Returns [h11, h12, h13, h21, h22, h23, h31, h32] (h33 normalized to 1).
function solveHomography(source, destination) {
  const A = [];
  const b = [];
  for (let index = 0; index < 4; index++) {
    const [x, y] = source[index];
    const [X, Y] = destination[index];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col] / A[col][col];
      for (let c = col; c < n; c++) A[row][c] -= factor * A[col][c];
      b[row] -= factor * b[col];
    }
  }
  return A.map((row, index) => b[index] / row[index]);
}

function applyFrameEffect() {
  tvFrame.classList.toggle('framed', frameEnabled);
  if (!frameEnabled) {
    screenElement.style.transform = '';
    applyBackgroundConfig();
    return;
  }
  // The framed photo already shows its own on-screen picture, so the
  // app's own badge would just duplicate it.
  bgBadge.hidden = true;
  const containerRect = tvPhotoWrap.getBoundingClientRect();
  const toPx = (pt) => [
    containerRect.left + (pt.x / 100) * containerRect.width,
    containerRect.top + (pt.y / 100) * containerRect.height,
  ];
  const W = window.innerWidth;
  const H = window.innerHeight;
  const h = solveHomography(
    [[0, 0], [W, 0], [0, H], [W, H]],
    [toPx(screenCorners.nw), toPx(screenCorners.ne), toPx(screenCorners.sw), toPx(screenCorners.se)]
  );
  screenElement.style.transform =
    `matrix3d(${h[0]}, ${h[3]}, 0, ${h[6]}, ${h[1]}, ${h[4]}, 0, ${h[7]}, 0, 0, 1, 0, ${h[2]}, ${h[5]}, 0, 1)`;
}

let frameEnabled = loadFrameEnabled();
frameEnabledInput.checked = frameEnabled;
applyFrameEffect();

frameEnabledInput.addEventListener('change', () => {
  frameEnabled = frameEnabledInput.checked;
  applyFrameEffect();
  saveFrameEnabled();
});

window.addEventListener('resize', () => {
  if (frameEnabled) applyFrameEffect();
});

function applySpeed(newSpeed) {
  vx = Math.sign(vx || 1) * newSpeed;
  vy = Math.sign(vy || 1) * newSpeed;
}

trailEnabledInput.addEventListener('change', () => {
  trailConfig.enabled = trailEnabledInput.checked;
  if (!trailConfig.enabled) {
    trailPoints = [];
    trailContext.clearRect(0, 0, trail.width, trail.height);
  }
  saveTrailConfig();
});

trailStyleInput.addEventListener('change', () => {
  trailConfig.style = trailStyleInput.value;
  saveTrailConfig();
});

trailSpeedInput.addEventListener('input', () => {
  trailConfig.speed = Number.parseFloat(trailSpeedInput.value);
  trailSpeedValue.textContent = trailConfig.speed + 'px';
  applySpeed(trailConfig.speed);
  saveTrailConfig();
});

trailSizeInput.addEventListener('input', () => {
  trailConfig.sizePct = Number.parseInt(trailSizeInput.value, 10);
  trailSizeValue.textContent = trailConfig.sizePct + '%';
  saveTrailConfig();
});

trailFadeInput.addEventListener('input', () => {
  trailConfig.fadeSeconds = Number.parseInt(trailFadeInput.value, 10);
  trailFadeValue.textContent = trailConfig.fadeSeconds + 's';
  saveTrailConfig();
});

trailOpacityInput.addEventListener('input', () => {
  trailConfig.opacityPct = Number.parseInt(trailOpacityInput.value, 10);
  trailOpacityValue.textContent = trailConfig.opacityPct + '%';
  saveTrailConfig();
});

function resizeCanvas() {
  fx.width = window.innerWidth;
  fx.height = window.innerHeight;
  trail.width = window.innerWidth;
  trail.height = window.innerHeight;
  trailPoints = [];
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let x = Math.random() * (window.innerWidth - 200);
let y = Math.random() * (window.innerHeight - 100);
let vx = trailConfig.speed, vy = trailConfig.speed;
let colorIndex = 0;
let currentColor = colors[0];

function setColor() {
  colorIndex = (colorIndex + Math.floor(Math.random() * 4) + 1) % colors.length;
  currentColor = colors[colorIndex];
  // Set on <html>, not just the bouncer, so --glow inherits down to the HUD
  // too (settings panel border/fills, countdown border) - the panel's
  // accent always matches whatever color is currently bouncing.
  document.documentElement.style.setProperty('--glow', currentColor);
}
setColor();

const PHOTO_SCALE = 2;
const DEFAULT_IMAGE = 'image.png';

function useImage(dataUrl) {
  bouncer.className = 'photo';
  bouncer.innerHTML = '';
  const tint = document.createElement('div');
  tint.className = 'tint';
  tint.style.webkitMaskImage = `url(${dataUrl})`;
  tint.style.maskImage = `url(${dataUrl})`;
  const probe = new Image();
  probe.addEventListener('load', () => {
    tint.style.width = (probe.naturalWidth * PHOTO_SCALE) + 'px';
    tint.style.height = (probe.naturalHeight * PHOTO_SCALE) + 'px';
  });
  probe.src = dataUrl;
  bouncer.append(tint);
  clearButton.hidden = false;
}

function clearImage() {
  useImage(DEFAULT_IMAGE);
  clearButton.hidden = true;
  fileInput.value = '';
  try { localStorage.removeItem('cornerWatchPhoto'); } catch {}
}

function loadSavedImage() {
  let saved = null;
  try { saved = localStorage.getItem('cornerWatchPhoto'); } catch {}
  useImage(saved || DEFAULT_IMAGE);
  clearButton.hidden = !saved;
}
loadSavedImage();

pickButton.addEventListener('click', () => fileInput.click());
clearButton.addEventListener('click', clearImage);

function loadImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const dataUrl = reader.result;
    useImage(dataUrl);
    try { localStorage.setItem('cornerWatchPhoto', dataUrl); } catch {}
  });
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', () => {
  loadImageFile(fileInput.files && fileInput.files[0]);
});

document.addEventListener('paste', (event) => {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      loadImageFile(item.getAsFile());
      event.preventDefault();
      break;
    }
  }
});

// --- corner celebration ---

let particles = [];
let audioContext = null;

// The actual tones the original 1972 Atari Pong hardware used: 459Hz for
// the top/bottom wall bounce, 226Hz (an octave down) for a paddle hit.
// Left/right edges stand in for paddles here, top/bottom for walls.
const PONG_WALL_HZ = 459;
const PONG_PADDLE_HZ = 226;

function playBeep(freq) {
  if (!soundEnabled) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const start = audioContext.currentTime;
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.06);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(start);
    osc.stop(start + 0.07);
  } catch {}
}

function playFanfare() {
  if (!soundEnabled) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (const [index, freq] of notes.entries()) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = audioContext.currentTime + index * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    }
  } catch {}
}

function spawnParticles(cx, cy) {
  for (let index = 0; index < 120; index++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 9;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1
    });
  }
}

function updateParticles() {
  fxContext.clearRect(0, 0, fx.width, fx.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.vy += 0.18;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    fxContext.save();
    fxContext.globalAlpha = Math.max(p.life, 0);
    fxContext.translate(p.x, p.y);
    fxContext.rotate(p.rot);
    fxContext.fillStyle = p.color;
    fxContext.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    fxContext.restore();
  }
}

function updateTrail(cx, cy, w, h, deltaMs) {
  if (!trailConfig.enabled) {
    if (trailPoints.length > 0) {
      trailPoints = [];
      trailContext.clearRect(0, 0, trail.width, trail.height);
    }
    return;
  }

  trailFrameCounter++;
  if (trailFrameCounter % TRAIL_SAMPLE_INTERVAL === 0) {
    const baseRadius = Math.max(6, Math.min(w, h) / 5) * (trailConfig.sizePct / 100);
    trailPoints.push({ x: cx, y: cy, radius: baseRadius, color: currentColor, age: 0 });
  }

  const lifetimeMs = trailConfig.fadeSeconds * 1000;
  const baseAlpha = trailConfig.opacityPct / 100;

  for (const p of trailPoints) p.age += deltaMs;
  trailPoints = trailPoints.filter(p => p.age < lifetimeMs);

  trailContext.clearRect(0, 0, trail.width, trail.height);
  trailContext.lineCap = 'round';
  trailContext.lineJoin = 'round';

  for (let index = 0; index < trailPoints.length; index++) {
    const p = trailPoints[index];
    const lifeFrac = 1 - p.age / lifetimeMs;
    trailContext.globalAlpha = baseAlpha * lifeFrac;

    if (trailConfig.style === 'line') {
      if (index === 0) continue;
      const previous = trailPoints[index - 1];
      trailContext.strokeStyle = p.color;
      trailContext.lineWidth = Math.max(2, p.radius);
      trailContext.beginPath();
      trailContext.moveTo(previous.x, previous.y);
      trailContext.lineTo(p.x, p.y);
      trailContext.stroke();
    } else if (trailConfig.style === 'comet') {
      trailContext.fillStyle = p.color;
      trailContext.beginPath();
      trailContext.arc(p.x, p.y, Math.max(0, p.radius * lifeFrac), 0, Math.PI * 2);
      trailContext.fill();
    } else if (trailConfig.style === 'rainbow') {
      trailContext.fillStyle = `hsl(${(index * 12) % 360}, 90%, 60%)`;
      trailContext.beginPath();
      trailContext.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      trailContext.fill();
    } else {
      trailContext.fillStyle = p.color;
      trailContext.beginPath();
      trailContext.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      trailContext.fill();
    }
  }

  trailContext.globalAlpha = 1;
}

function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function extendedGcd(a, b) {
  if (b === 0) return [a, 1, 0];
  const [g, x1, y1] = extendedGcd(b, a % b);
  return [g, y1, x1 - Math.floor(a / b) * y1];
}

// Smallest t >= 0 with t ≡ a1 (mod n1) and t ≡ a2 (mod n2), or null if
// no such t exists (the two cycles never align).
function solveCRT(a1, n1, a2, n2) {
  const [g, p] = extendedGcd(n1, n2);
  if ((a2 - a1) % g !== 0) return null;
  const lcm = (n1 / g) * n2;
  const t = a1 + n1 * (((a2 - a1) / g) * p % (n2 / g));
  return ((t % lcm) + lcm) % lcm;
}

// requestAnimationFrame fires at the display's actual refresh rate (120Hz,
// 144Hz, ...), not always 60Hz, so frame counts are converted to seconds
// using this measured rate instead of an assumed 60fps. Measured as a true
// average over a multi-second window (frames / elapsed time), not a
// per-frame exponential smoothing — dividing a huge frame count by a
// rate estimate that reacts to every single frame's timing noise (a GC
// pause, a compositor hiccup) turns that noise into wild swings in the
// displayed seconds, so the estimate has to come from many frames at once.
let measuredFps = 60;
let fpsWindowStartMs = null;
let fpsWindowFrameCount = 0;
const FPS_WINDOW_MS = 2000;

function formatCountdown(frames) {
  const secs = frames / measuredFps;
  if (secs < 60) return secs.toFixed(1) + 's';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

// Exact test, not a simulation: after each wall hit the position snaps
// to an integer boundary, so the whole path becomes a fixed, repeating
// pattern. A corner is reachable iff the two axes' bounce timings can
// ever land on the same frame, which is a plain gcd/CRT check.
const COUNTDOWN_RENDER_INTERVAL_MS = 200;
let lastCountdownRenderMs = 0;

function updateStatus(x, y, vx, vy, maxX, maxY) {
  if (maxX <= 0 || maxY <= 0) return;

  const framesToBoundary = (pos, vel, max) =>
    vel > 0 ? Math.ceil((max - pos) / vel) : Math.ceil(pos / -vel);

  const Px = Math.ceil(maxX / Math.abs(vx));
  const Py = Math.ceil(maxY / Math.abs(vy));
  const a1 = framesToBoundary(x, vx, maxX) % Px;
  const a2 = framesToBoundary(y, vy, maxY) % Py;
  const framesUntilCorner = solveCRT(a1, Px, a2, Py);
  const possible = framesUntilCorner !== null;

  if (!possible) {
    countdownLabel.textContent = 'No corner possible in this run';
    countdownTime.textContent = '';
    return;
  }

  // The countdown text is throttled rather than written every frame:
  // formatCountdown's output is sensitive to small noise in measuredFps
  // (see above), and writing every single frame made that residual noise
  // visible as flicker even after smoothing the rate estimate itself.
  const nowMs = performance.now();
  if (nowMs - lastCountdownRenderMs >= COUNTDOWN_RENDER_INTERVAL_MS) {
    lastCountdownRenderMs = nowMs;
    countdownLabel.textContent = 'Next corner in ';
    countdownTime.textContent = formatCountdown(framesUntilCorner);
  }
}

function celebrateCorner(cx, cy) {
  spawnParticles(cx, cy);

  cornerText.textContent = cornerPhrases[Math.floor(Math.random() * cornerPhrases.length)];
  cornerText.style.color = colors[Math.floor(Math.random() * colors.length)];
  cornerText.classList.remove('active');
  void cornerText.offsetWidth;
  cornerText.classList.add('active');

  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');

  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');

  playFanfare();
}

let lastTickTime = null;

function tick(now) {
  let deltaMs = 1000 / measuredFps;
  if (lastTickTime !== null) {
    const rawDeltaMs = now - lastTickTime;
    if (rawDeltaMs > 0 && rawDeltaMs < 1000) deltaMs = rawDeltaMs;
  }
  lastTickTime = now;

  if (fpsWindowStartMs === null) {
    fpsWindowStartMs = now;
    fpsWindowFrameCount = 0;
  } else {
    fpsWindowFrameCount++;
    const windowElapsedMs = now - fpsWindowStartMs;
    if (windowElapsedMs >= FPS_WINDOW_MS) {
      measuredFps = fpsWindowFrameCount / (windowElapsedMs / 1000);
      fpsWindowStartMs = now;
      fpsWindowFrameCount = 0;
    }
  }

  const w = bouncer.offsetWidth;
  const h = bouncer.offsetHeight;
  const maxX = window.innerWidth - w;
  const maxY = window.innerHeight - h;

  x += vx;
  y += vy;

  let hitX = false, hitY = false;

  if (x <= 0) { x = 0; vx = -vx; hitX = true; }
  else if (x >= maxX) { x = maxX; vx = -vx; hitX = true; }

  if (y <= 0) { y = 0; vy = -vy; hitY = true; }
  else if (y >= maxY) { y = maxY; vy = -vy; hitY = true; }

  if (hitX || hitY) setColor();

  if (hitX && hitY) {
    const cornerX = (x <= 0) ? 0 : window.innerWidth;
    const cornerY = (y <= 0) ? 0 : window.innerHeight;
    celebrateCorner(cornerX, cornerY);
  } else if (hitX) {
    playBeep(PONG_PADDLE_HZ);
  } else if (hitY) {
    playBeep(PONG_WALL_HZ);
  }

  bouncer.style.transform = `translate(${x}px, ${y}px)`;

  updateStatus(x, y, vx, vy, maxX, maxY);
  updateTrail(x + w / 2, y + h / 2, w, h, deltaMs);

  if (particles.length > 0) updateParticles();

  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  x = Math.min(x, window.innerWidth - bouncer.offsetWidth);
  y = Math.min(y, window.innerHeight - bouncer.offsetHeight);
});

requestAnimationFrame(tick);

// The HUD (settings button + countdown ticker) fades out after a stretch of
// no mouse movement. Waking back up isn't instant on the first pixel of
// motion either: a stray jiggle of the mouse shouldn't flash it back on, so
// movement has to keep going for HUD_WAKE_MS before it's revealed again.
const HUD_IDLE_MS = 3000;
const HUD_WAKE_MS = 1100;
let hudIdleTimer = null;
let hudWakeTimer = null;

function armHudIdleTimer() {
  clearTimeout(hudIdleTimer);
  hudIdleTimer = setTimeout(() => {
    document.body.classList.add('idle');
  }, HUD_IDLE_MS);
}

function onHudMouseMove() {
  armHudIdleTimer();

  if (!document.body.classList.contains('idle')) return;
  if (hudWakeTimer !== null) return;

  hudWakeTimer = setTimeout(() => {
    document.body.classList.remove('idle');
    hudWakeTimer = null;
  }, HUD_WAKE_MS);
}
window.addEventListener('mousemove', onHudMouseMove);
armHudIdleTimer();

// Test-only: set the bouncer's position/velocity directly, so a test can
// engineer an exact wall/corner hit instead of waiting for `tick` to drift
// there on its own. Not used by the app itself.
function __setStateForTest({ x: nx, y: ny, vx: nvx, vy: nvy } = {}) {
  if (nx !== undefined) x = nx;
  if (ny !== undefined) y = ny;
  if (nvx !== undefined) vx = nvx;
  if (nvy !== undefined) vy = nvy;
}

export {
  gcd,
  extendedGcd,
  solveCRT,
  formatCountdown,
  loadTrailConfig,
  saveTrailConfig,
  loadCountdownVisible,
  loadSoundEnabled,
  PALETTES,
  loadPalette,
  savePalette,
  swatchGradient,
  selectPalette,
  loadCrtConfig,
  saveCrtConfig,
  applyCrtEffect,
  BACKGROUND_COLORS,
  BADGE_TEXT,
  loadBackgroundConfig,
  saveBackgroundConfig,
  applyBackgroundConfig,
  backgroundConfig,
  loadFrameEnabled,
  saveFrameEnabled,
  applyFrameEffect,
  applySpeed,
  resizeCanvas,
  setColor,
  useImage,
  clearImage,
  loadSavedImage,
  loadImageFile,
  playBeep,
  playFanfare,
  spawnParticles,
  updateParticles,
  updateTrail,
  updateStatus,
  celebrateCorner,
  tick,
  x,
  y,
  vx,
  vy,
  trailConfig,
  crtConfig,
  trailPoints,
  particles,
  measuredFps,
  HUD_IDLE_MS,
  HUD_WAKE_MS,
  armHudIdleTimer,
  onHudMouseMove,
  __setStateForTest,
};
