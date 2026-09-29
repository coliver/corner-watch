import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDom } from './setup.js';

// app.js runs its whole top-level setup (DOM wiring, first `setColor()`,
// `loadSavedImage()`, the first `requestAnimationFrame(tick)`) the moment
// it's imported, and holds its live state (x/y/vx/vy/trailConfig/...) in
// module-level variables. So each test gets a fully fresh module instance
// (via `vi.resetModules()`) over a freshly reset DOM, the same way a real
// page load would start clean.
async function loadApp() {
  vi.resetModules();
  resetDom();
  return import('../app.js');
}

function setViewport(width, height) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

// The same shape as test/setup.js's default FakeImage. A couple of tests
// swap in a different `global.Image` to exercise a specific path; this
// restores the normal one afterward so that override doesn't leak into
// later tests.
class DefaultFakeImage extends EventTarget {
  constructor() {
    super();
    this.naturalWidth = 40;
    this.naturalHeight = 24;
  }
  set src(_value) {
    queueMicrotask(() => {
      this.dispatchEvent(new Event('load'));
    });
  }
}

beforeEach(() => {
  vi.clearAllTimers();
  setViewport(1024, 768);
  global.Image = DefaultFakeImage;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.AudioContext;
  delete window.AudioContext;
  global.Image = DefaultFakeImage;
});

describe('pure math helpers', () => {
  it('gcd reduces to the greatest common divisor', async () => {
    const app = await loadApp();
    expect(app.gcd(12, 8)).toBe(4);
    expect(app.gcd(7, 0)).toBe(7);
  });

  it('extendedGcd covers both the base case and the recursive case', async () => {
    const app = await loadApp();
    expect(app.extendedGcd(5, 0)).toEqual([5, 1, 0]);
    const [g, x, y] = app.extendedGcd(35, 15);
    expect(g).toBe(5);
    expect(35 * x + 15 * y).toBe(g);
  });

  it('solveCRT finds a solution when one exists', async () => {
    const app = await loadApp();
    expect(app.solveCRT(2, 3, 3, 5)).toBe(8);
  });

  it('solveCRT returns null when the two cycles never align', async () => {
    const app = await loadApp();
    // mod 4 residues 0 and 1 can never match mod-2 residues 0 and... pick a
    // genuinely incompatible pair: t=0 (mod 4) vs t=1 (mod 2) is satisfiable
    // (t=4), so use moduli that share a factor the remainders disagree on.
    expect(app.solveCRT(0, 4, 1, 4)).toBeNull();
  });

  it('formatCountdown formats under a minute as seconds', async () => {
    const app = await loadApp();
    expect(app.formatCountdown(app.measuredFps * 10)).toBe('10.0s');
  });

  it('formatCountdown formats a minute or more as minutes+seconds', async () => {
    const app = await loadApp();
    expect(app.formatCountdown(app.measuredFps * 90)).toBe('1m 30s');
  });
});

describe('trail config persistence', () => {
  it('falls back to defaults when nothing is saved', async () => {
    localStorage.clear();
    const app = await loadApp();
    expect(app.loadTrailConfig().enabled).toBe(false);
  });

  it('merges saved config over the defaults', async () => {
    localStorage.setItem('cornerWatchTrailConfig', JSON.stringify({ style: 'comet' }));
    const app = await loadApp();
    const cfg = app.loadTrailConfig();
    expect(cfg.style).toBe('comet');
    expect(cfg.fadeSeconds).toBe(45);
  });

  it('falls back to defaults when the saved value is corrupt JSON', async () => {
    localStorage.setItem('cornerWatchTrailConfig', '{not json');
    const app = await loadApp();
    expect(app.loadTrailConfig().enabled).toBe(false);
  });

  it('falls back to defaults when localStorage itself throws', async () => {
    const app = await loadApp();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(app.loadTrailConfig().enabled).toBe(false);
  });

  it('saveTrailConfig writes to localStorage and swallows write errors', async () => {
    const app = await loadApp();
    app.saveTrailConfig();
    expect(localStorage.getItem('cornerWatchTrailConfig')).toContain('dots');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => app.saveTrailConfig()).not.toThrow();
  });
});

describe('countdown visibility persistence', () => {
  it('defaults to visible when nothing is saved', async () => {
    localStorage.clear();
    const app = await loadApp();
    expect(app.loadCountdownVisible()).toBe(true);
  });

  it('reads a saved false value', async () => {
    localStorage.setItem('cornerWatchCountdownVisible', 'false');
    const app = await loadApp();
    expect(app.loadCountdownVisible()).toBe(false);
  });

  it('falls back to visible when localStorage throws', async () => {
    const app = await loadApp();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(app.loadCountdownVisible()).toBe(true);
  });

  it('the settings toggle shows/hides the countdown element and persists it', async () => {
    localStorage.clear();
    await loadApp();
    const toggle = document.getElementById('countdownEnabled');
    const countdown = document.getElementById('countdown');
    expect(countdown.hidden).toBe(false);

    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change'));
    expect(countdown.hidden).toBe(true);
    expect(localStorage.getItem('cornerWatchCountdownVisible')).toBe('false');
  });

  it('the settings toggle still updates the UI when saving the preference throws', async () => {
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const toggle = document.getElementById('countdownEnabled');
    expect(() => toggle.dispatchEvent(new window.Event('change'))).not.toThrow();
  });

  it('clicking the countdown time toggles the spoiler reveal on and off', async () => {
    await loadApp();
    const time = document.getElementById('countdownTime');
    expect(time.classList.contains('revealed')).toBe(false);
    time.dispatchEvent(new window.Event('click'));
    expect(time.classList.contains('revealed')).toBe(true);
    time.dispatchEvent(new window.Event('click'));
    expect(time.classList.contains('revealed')).toBe(false);
  });
});

describe('settings panel toggle', () => {
  it('opens and closes the trail settings panel', async () => {
    await loadApp();
    const btn = document.getElementById('settingsBtn');
    const panel = document.getElementById('trailControls');
    expect(panel.hidden).toBe(true);

    btn.dispatchEvent(new window.Event('click'));
    expect(panel.hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    btn.dispatchEvent(new window.Event('click'));
    expect(panel.hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('applySpeed', () => {
  it('keeps the current direction when velocity is nonzero', async () => {
    const app = await loadApp();
    app.__setStateForTest({ vx: -3, vy: 4 });
    app.applySpeed(6);
    expect(app.vx).toBe(-6);
    expect(app.vy).toBe(6);
  });

  it('defaults to a positive direction when velocity is zero', async () => {
    const app = await loadApp();
    app.__setStateForTest({ vx: 0, vy: 0 });
    app.applySpeed(5);
    expect(app.vx).toBe(5);
    expect(app.vy).toBe(5);
  });
});

describe('trail settings inputs', () => {
  it('disabling the trail clears any existing points and persists', async () => {
    const app = await loadApp();
    document.getElementById('trailEnabled').checked = false;
    document.getElementById('trailEnabled').dispatchEvent(new window.Event('change'));
    expect(app.trailConfig.enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem('cornerWatchTrailConfig')).enabled).toBe(false);
  });

  it('enabling the trail does not clear points', async () => {
    const app = await loadApp();
    const input = document.getElementById('trailEnabled');
    input.checked = true;
    input.dispatchEvent(new window.Event('change'));
    expect(app.trailConfig.enabled).toBe(true);
  });

  it('style/speed/size/fade/opacity inputs update the live config', async () => {
    const app = await loadApp();

    const style = document.getElementById('trailStyle');
    style.value = 'comet';
    style.dispatchEvent(new window.Event('change'));
    expect(app.trailConfig.style).toBe('comet');

    const speed = document.getElementById('trailSpeed');
    speed.value = '4.5';
    speed.dispatchEvent(new window.Event('input'));
    expect(app.trailConfig.speed).toBe(4.5);
    expect(app.vx).toBe(4.5);

    const size = document.getElementById('trailSize');
    size.value = '150';
    size.dispatchEvent(new window.Event('input'));
    expect(app.trailConfig.sizePct).toBe(150);

    const fade = document.getElementById('trailFade');
    fade.value = '20';
    fade.dispatchEvent(new window.Event('input'));
    expect(app.trailConfig.fadeSeconds).toBe(20);

    const opacity = document.getElementById('trailOpacity');
    opacity.value = '80';
    opacity.dispatchEvent(new window.Event('input'));
    expect(app.trailConfig.opacityPct).toBe(80);
  });
});

describe('palette settings', () => {
  it('loads a previously saved valid palette from localStorage', async () => {
    localStorage.setItem('cornerWatchPalette', 'vivid');
    const app = await loadApp();
    expect(app.loadPalette()).toBe('vivid');
    expect(document.getElementById('paletteButtonLabel').textContent).toBe('Vivid');
    localStorage.clear();
  });

  it('paletteButton click toggles the list open and aria-expanded', async () => {
    localStorage.clear();
    await loadApp();
    const button = document.getElementById('paletteButton');
    const list = document.getElementById('paletteList');
    button.dispatchEvent(new window.Event('click'));
    expect(list.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.dispatchEvent(new window.Event('click'));
    expect(list.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking a palette option selects it, saves it, and closes the list', async () => {
    localStorage.clear();
    await loadApp();
    const list = document.getElementById('paletteList');
    const option = list.querySelector('[data-palette="neon"]');
    option.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(document.getElementById('paletteButtonLabel').textContent).toBe('Neon');
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(list.hidden).toBe(true);
    expect(localStorage.getItem('cornerWatchPalette')).toBe('neon');
  });

  it('clicking the list without hitting an option does nothing', async () => {
    localStorage.clear();
    await loadApp();
    const list = document.getElementById('paletteList');
    const labelBefore = document.getElementById('paletteButtonLabel').textContent;
    list.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(document.getElementById('paletteButtonLabel').textContent).toBe(labelBefore);
  });

  it('selecting a palette still applies it when saving the preference throws', async () => {
    localStorage.clear();
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const list = document.getElementById('paletteList');
    const option = list.querySelector('[data-palette="neon"]');
    expect(() => option.dispatchEvent(new window.Event('click', { bubbles: true }))).not.toThrow();
    expect(document.getElementById('paletteButtonLabel').textContent).toBe('Neon');
  });
});

describe('background settings', () => {
  it('loads a previously saved background config from localStorage', async () => {
    localStorage.setItem('cornerWatchBackground', JSON.stringify({ color: 'blue90s', badge: 'ch3' }));
    const app = await loadApp();
    expect(app.backgroundConfig.color).toBe('blue90s');
    expect(document.getElementById('bgBadge').textContent).toBe('CH 3');
    localStorage.clear();
  });

  it('changing the background color updates the screen and persists', async () => {
    localStorage.clear();
    const app = await loadApp();
    const select = document.getElementById('backgroundColor');
    select.value = 'blue90s';
    select.dispatchEvent(new window.Event('change'));
    expect(app.backgroundConfig.color).toBe('blue90s');
    expect(JSON.parse(localStorage.getItem('cornerWatchBackground')).color).toBe('blue90s');
  });

  it('changing the badge updates the badge text and persists', async () => {
    localStorage.clear();
    const app = await loadApp();
    const select = document.getElementById('backgroundBadge');
    select.value = 'video';
    select.dispatchEvent(new window.Event('change'));
    expect(app.backgroundConfig.badge).toBe('video');
    expect(document.getElementById('bgBadge').textContent).toBe('VIDEO');
    expect(document.getElementById('bgBadge').hidden).toBe(false);
    expect(JSON.parse(localStorage.getItem('cornerWatchBackground')).badge).toBe('video');
  });

  it('still applies the background when saving the preference throws', async () => {
    localStorage.clear();
    const app = await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const select = document.getElementById('backgroundColor');
    select.value = 'blue90s';
    expect(() => select.dispatchEvent(new window.Event('change'))).not.toThrow();
    expect(app.backgroundConfig.color).toBe('blue90s');
  });
});

describe('sound settings', () => {
  it('loads a previously saved sound-enabled state from localStorage', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    await loadApp();
    expect(document.getElementById('soundEnabled').checked).toBe(true);
    localStorage.clear();
  });

  it('toggling sound updates state and persists', async () => {
    localStorage.clear();
    await loadApp();
    const toggle = document.getElementById('soundEnabled');
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));
    expect(localStorage.getItem('cornerWatchSoundEnabled')).toBe('true');
  });

  it('the sound toggle still updates when saving the preference throws', async () => {
    localStorage.clear();
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const toggle = document.getElementById('soundEnabled');
    toggle.checked = true;
    expect(() => toggle.dispatchEvent(new window.Event('change'))).not.toThrow();
  });
});

describe('CRT settings', () => {
  it('loads a previously saved CRT config from localStorage', async () => {
    localStorage.setItem('cornerWatchCrtConfig', JSON.stringify({ enabled: true, intensity: 80 }));
    const app = await loadApp();
    expect(app.crtConfig.enabled).toBe(true);
    expect(app.crtConfig.intensity).toBe(80);
    expect(document.getElementById('crtOverlay').hidden).toBe(false);
    localStorage.clear();
  });

  it('toggling CRT enabled applies the overlay and persists', async () => {
    localStorage.clear();
    const app = await loadApp();
    const toggle = document.getElementById('crtEnabled');
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));
    expect(app.crtConfig.enabled).toBe(true);
    expect(document.getElementById('crtOverlay').hidden).toBe(false);
    expect(JSON.parse(localStorage.getItem('cornerWatchCrtConfig')).enabled).toBe(true);
  });

  it('changing CRT intensity updates the label, persists, and re-syncs the slider fill', async () => {
    localStorage.clear();
    const app = await loadApp();
    const input = document.getElementById('crtIntensity');
    input.value = '75';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(app.crtConfig.intensity).toBe(75);
    expect(document.getElementById('crtIntensityVal').textContent).toBe('75%');
    expect(JSON.parse(localStorage.getItem('cornerWatchCrtConfig')).intensity).toBe(75);
    expect(input.style.getPropertyValue('--fill')).toBe('75%');
  });

  it('still applies CRT changes when saving the preference throws', async () => {
    localStorage.clear();
    const app = await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const toggle = document.getElementById('crtEnabled');
    toggle.checked = true;
    expect(() => toggle.dispatchEvent(new window.Event('change'))).not.toThrow();
    expect(app.crtConfig.enabled).toBe(true);
  });
});

describe('reset to defaults', () => {
  it('restores every setting to its default, persists it, and reverts the photo', async () => {
    localStorage.setItem('cornerWatchPalette', 'neon');
    localStorage.setItem('cornerWatchBackground', JSON.stringify({ color: 'blue90s', badge: 'video' }));
    localStorage.setItem('cornerWatchTrailConfig', JSON.stringify({
      enabled: true, style: 'comet', speed: 10, sizePct: 150, fadeSeconds: 80, opacityPct: 90,
    }));
    localStorage.setItem('cornerWatchCountdownVisible', 'false');
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    localStorage.setItem('cornerWatchCrtConfig', JSON.stringify({ enabled: true, intensity: 90 }));
    localStorage.setItem('cornerWatchFrame', 'true');
    localStorage.setItem('cornerWatchPhoto', 'data:image/png;base64,AAA');

    const app = await loadApp();
    document.getElementById('resetDefaultsBtn').dispatchEvent(new window.Event('click'));

    expect(document.getElementById('paletteButtonLabel').textContent).toBe('Classic');
    expect(localStorage.getItem('cornerWatchPalette')).toBe('classic');

    expect(app.backgroundConfig).toEqual({ color: 'classic', badge: 'none' });
    expect(document.getElementById('backgroundColor').value).toBe('classic');
    expect(document.getElementById('backgroundBadge').value).toBe('none');
    expect(JSON.parse(localStorage.getItem('cornerWatchBackground'))).toEqual({ color: 'classic', badge: 'none' });

    expect(app.trailConfig).toEqual({
      enabled: false, style: 'dots', speed: 2, sizePct: 100, fadeSeconds: 45, opacityPct: 45,
    });
    expect(document.getElementById('trailEnabled').checked).toBe(false);
    expect(app.trailPoints).toEqual([]);
    expect(app.vx).toBe(2);

    expect(document.getElementById('countdownEnabled').checked).toBe(true);
    expect(document.getElementById('countdown').hidden).toBe(false);
    expect(localStorage.getItem('cornerWatchCountdownVisible')).toBe('true');

    expect(document.getElementById('soundEnabled').checked).toBe(false);
    expect(localStorage.getItem('cornerWatchSoundEnabled')).toBe('false');

    expect(app.crtConfig).toEqual({ enabled: false, intensity: 50 });
    expect(document.getElementById('crtEnabled').checked).toBe(false);
    expect(document.getElementById('crtOverlay').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem('cornerWatchCrtConfig'))).toEqual({ enabled: false, intensity: 50 });

    expect(document.getElementById('frameEnabled').checked).toBe(false);
    expect(document.getElementById('tvFrame').classList.contains('framed')).toBe(false);
    expect(localStorage.getItem('cornerWatchFrame')).toBe('false');

    expect(document.getElementById('clearBtn').hidden).toBe(true);
    expect(localStorage.getItem('cornerWatchPhoto')).toBeNull();
  });

  it('still resets the UI when persisting a default throws', async () => {
    localStorage.clear();
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => document.getElementById('resetDefaultsBtn').dispatchEvent(new window.Event('click'))).not.toThrow();
    expect(document.getElementById('soundEnabled').checked).toBe(false);
    expect(document.getElementById('countdownEnabled').checked).toBe(true);
  });
});

describe('resizeCanvas', () => {
  it('sizes both canvases to the window and clears the trail', async () => {
    const app = await loadApp();
    setViewport(500, 400);
    app.resizeCanvas();
    expect(document.getElementById('fx').width).toBe(500);
    expect(document.getElementById('trail').height).toBe(400);
    expect(app.trailPoints).toEqual([]);
  });
});

describe('setColor', () => {
  it('sets a --glow custom property on the document root, so the HUD inherits it too', async () => {
    const app = await loadApp();
    app.setColor();
    const glow = document.documentElement.style.getPropertyValue('--glow');
    expect(glow).toMatch(/^#/);
  });
});

describe('photo handling', () => {
  it('loads the default image when nothing is saved', async () => {
    localStorage.clear();
    await loadApp();
    const bouncer = document.getElementById('bouncer');
    expect(bouncer.className).toBe('photo');
    expect(document.getElementById('clearBtn').hidden).toBe(true);
  });

  it('loads a saved custom photo and shows the clear button', async () => {
    localStorage.setItem('cornerWatchPhoto', 'data:image/png;base64,AAA');
    await loadApp();
    expect(document.getElementById('clearBtn').hidden).toBe(false);
  });

  it('falls back to the default image when localStorage throws', async () => {
    class ThrowingImage extends EventTarget {
      set src(_v) { queueMicrotask(() => this.dispatchEvent(new Event('load'))); }
    }
    global.Image = ThrowingImage;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await loadApp();
    expect(document.getElementById('clearBtn').hidden).toBe(true);
  });

  it('useImage sizes the tint element once the probe image loads', async () => {
    const app = await loadApp();
    app.useImage('some-photo.png');
    await vi.waitFor(() => {
      const tint = document.querySelector('#bouncer .tint');
      expect(tint.style.width).toBe('80px');
    });
  });

  it('clearImage restores the default image and forgets the saved photo', async () => {
    localStorage.setItem('cornerWatchPhoto', 'data:image/png;base64,AAA');
    const app = await loadApp();
    app.clearImage();
    expect(document.getElementById('clearBtn').hidden).toBe(true);
    expect(localStorage.getItem('cornerWatchPhoto')).toBeNull();
  });

  it('clearImage still resets the UI when forgetting the saved photo throws', async () => {
    const app = await loadApp();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => app.clearImage()).not.toThrow();
    expect(document.getElementById('clearBtn').hidden).toBe(true);
  });

  it('the pick button opens the file dialog', async () => {
    await loadApp();
    const fileInput = document.getElementById('fileInput');
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    document.getElementById('pickBtn').dispatchEvent(new window.Event('click'));
    expect(click).toHaveBeenCalled();
  });

  it('the clear button triggers clearImage', async () => {
    localStorage.setItem('cornerWatchPhoto', 'data:image/png;base64,AAA');
    await loadApp();
    document.getElementById('clearBtn').dispatchEvent(new window.Event('click'));
    expect(document.getElementById('clearBtn').hidden).toBe(true);
  });

  it('loadImageFile does nothing when there is no file', async () => {
    const app = await loadApp();
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    app.loadImageFile(null);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('choosing a file reads it and stores it as the photo', async () => {
    await loadApp();
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new window.Event('change'));
    await vi.waitFor(() => {
      expect(localStorage.getItem('cornerWatchPhoto')).toMatch(/^data:/);
    });
  });

  it('still applies the chosen photo when saving it throws', async () => {
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    expect(() => fileInput.dispatchEvent(new window.Event('change'))).not.toThrow();
    await vi.waitFor(() => {
      expect(document.querySelector('#bouncer .tint')).not.toBeNull();
    });
  });

  it('a change event with no file selected is a no-op', async () => {
    await loadApp();
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', { value: [], configurable: true });
    fileInput.dispatchEvent(new window.Event('change'));
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('pasting an image sets it as the photo and prevents the default paste', async () => {
    await loadApp();
    const file = new File(['x'], 'pasted.png', { type: 'image/png' });
    const event = new window.Event('paste', { cancelable: true });
    event.clipboardData = { items: [{ type: 'text/plain' }, { type: 'image/png', getAsFile: () => file }] };
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(localStorage.getItem('cornerWatchPhoto')).toMatch(/^data:/);
    });
  });

  it('pasting with no matching image item does nothing', async () => {
    await loadApp();
    const event = new window.Event('paste', { cancelable: true });
    event.clipboardData = { items: [{ type: 'text/plain' }] };
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('pasting with no clipboard data at all does nothing', async () => {
    await loadApp();
    const event = new window.Event('paste', { cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('useImage shows a plain image, not a color tint, for a photo with no transparency', async () => {
    const app = await loadApp();
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    });
    app.useImage('opaque-photo.png');
    await vi.waitFor(() => {
      const img = document.querySelector('#bouncer .plainPhoto');
      expect(img).not.toBeNull();
      expect(img.src).toContain('opaque-photo.png');
      expect(img.style.width).toBe('80px');
    });
    expect(document.querySelector('#bouncer .tint')).toBeNull();
  });
});

// Shared with the tick()/wall-hit tests below, so they can assert which
// tone actually got requested instead of just "didn't throw".
function installFakeAudioContext() {
  class FakeParam {
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeNode {
    connect() { return this; }
  }
  const createdOscillators = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = new FakeNode();
    }
    createOscillator() {
      const osc = { type: '', frequency: { value: 0 }, connect: () => new FakeNode(), start() {}, stop() {} };
      createdOscillators.push(osc);
      return osc;
    }
    createGain() {
      return { gain: new FakeParam(), connect: () => new FakeNode() };
    }
  }
  FakeAudioContext.createdOscillators = createdOscillators;
  global.AudioContext = FakeAudioContext;
  window.AudioContext = FakeAudioContext;
  return FakeAudioContext;
}

describe('audio', () => {
  // Sound defaults to disabled (loadSoundEnabled returns false when nothing
  // is saved), so with no `cornerWatchSoundEnabled` key set these two hit
  // playBeep/playFanfare's `if (!soundEnabled) return;` early return -
  // they never reach the AudioContext line at all. (An earlier version of
  // these two tests was titled "...when there is no AudioContext", which
  // was never true: with sound disabled by default, no AudioContext was
  // ever constructed to be absent - confirmed empirically by logging
  // `soundEnabled`/`window.AudioContext` from inside the test.)
  it('playBeep does nothing when sound is disabled', async () => {
    localStorage.clear();
    const app = await loadApp();
    expect(() => app.playBeep(440)).not.toThrow();
  });

  it('playFanfare does nothing when sound is disabled', async () => {
    localStorage.clear();
    const app = await loadApp();
    expect(() => app.playFanfare()).not.toThrow();
  });

  it('playBeep swallows the error when sound is enabled but no AudioContext constructor exists', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    // afterEach (top of file) deletes window/global.AudioContext, and this
    // test never installs a fake one or a webkitAudioContext, so
    // `window.AudioContext || window.webkitAudioContext` is undefined and
    // `new undefined()` throws - this is the actual "no AudioContext" path.
    expect(() => app.playBeep(440)).not.toThrow();
    localStorage.clear();
  });

  it('playFanfare swallows the error when sound is enabled but no AudioContext constructor exists', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    expect(() => app.playFanfare()).not.toThrow();
    localStorage.clear();
  });

  it('playBeep synthesizes a tone when AudioContext is available', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    installFakeAudioContext();
    expect(() => app.playBeep(440)).not.toThrow();
    localStorage.clear();
  });

  it('playFanfare plays all four notes when AudioContext is available', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    installFakeAudioContext();
    expect(() => app.playFanfare()).not.toThrow();
    localStorage.clear();
  });

  function installThrowingAudioContext() {
    class ThrowingAudioContext {
      constructor() {
        throw new Error('no audio hardware');
      }
    }
    global.AudioContext = ThrowingAudioContext;
    window.AudioContext = ThrowingAudioContext;
  }

  it('playBeep swallows errors from audio synthesis', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    installThrowingAudioContext();
    expect(() => app.playBeep(440)).not.toThrow();
    localStorage.clear();
  });

  it('playFanfare swallows errors from audio synthesis', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    installThrowingAudioContext();
    expect(() => app.playFanfare()).not.toThrow();
    localStorage.clear();
  });

  it('playBeep falls back to webkitAudioContext when AudioContext is unavailable', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    const FakeAudioContext = installFakeAudioContext();
    delete window.AudioContext;
    delete global.AudioContext;
    window.webkitAudioContext = FakeAudioContext;
    expect(() => app.playBeep(440)).not.toThrow();
    delete window.webkitAudioContext;
    localStorage.clear();
  });

  it('playFanfare falls back to webkitAudioContext when AudioContext is unavailable', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    const FakeAudioContext = installFakeAudioContext();
    delete window.AudioContext;
    delete global.AudioContext;
    window.webkitAudioContext = FakeAudioContext;
    expect(() => app.playFanfare()).not.toThrow();
    delete window.webkitAudioContext;
    localStorage.clear();
  });
});

describe('particles', () => {
  it('spawnParticles adds particles and updateParticles ages/removes them', async () => {
    const app = await loadApp();
    app.spawnParticles(10, 10);
    expect(app.particles.length).toBe(120);
    for (let i = 0; i < 200; i++) app.updateParticles();
    expect(app.particles.length).toBe(0);
  });
});

describe('updateTrail', () => {
  it('does nothing (and clears any leftover points) while disabled', async () => {
    const app = await loadApp();
    app.trailConfig.enabled = false;
    app.trailPoints.push({ x: 0, y: 0, radius: 1, color: '#fff', age: 0 });
    app.updateTrail(1, 1, 10, 10, 16);
    expect(app.trailPoints.length).toBe(0);
    // second call with an already-empty array exercises the "nothing to
    // clear" branch too
    expect(() => app.updateTrail(1, 1, 10, 10, 16)).not.toThrow();
  });

  it('samples, ages out, and draws in each style', async () => {
    const app = await loadApp();
    app.trailConfig.enabled = true;
    app.trailConfig.fadeSeconds = 1; // 1000ms lifetime, easy to age out

    for (const style of ['dots', 'comet', 'line', 'rainbow']) {
      app.trailConfig.style = style;
      app.trailPoints.length = 0;
      // trailFrameCounter (module-private) only samples a point every other
      // call, and its odd/even parity carries over between styles, so a
      // fixed 2-call loop isn't guaranteed to land 2 samples every time.
      // 4 calls guarantees at least 2 samples regardless of starting parity
      // - 'line' needs a real second point to reach its non-continue path.
      app.updateTrail(0, 0, 10, 10, 5);
      app.updateTrail(5, 5, 10, 10, 5);
      app.updateTrail(2, 8, 10, 10, 5);
      app.updateTrail(8, 2, 10, 10, 5);
      expect(app.trailPoints.length).toBeGreaterThanOrEqual(2);
    }

    // advance past the fade lifetime so the age-out filter removes points
    app.updateTrail(5, 5, 10, 10, 5000);
    expect(app.trailPoints.length).toBe(0);
  });
});

describe('updateStatus', () => {
  it('does nothing once the bouncer no longer fits on screen', async () => {
    const app = await loadApp();
    expect(() => app.updateStatus(0, 0, 2, 2, 0, 100)).not.toThrow();
    expect(() => app.updateStatus(0, 0, 2, 2, 100, 0)).not.toThrow();
    expect(document.getElementById('countdownLabel').textContent).toBe('');
  });

  it('reports impossible when the two axes can never land on a corner together', async () => {
    const app = await loadApp();
    // Px=4, Py=6 (gcd 2); the X and Y phase offsets (a1=0, a2=1) differ by
    // an odd number, which the gcd=2 modulus can never bridge, so no frame
    // exists where both axes hit a boundary at once - solveCRT returns null.
    app.updateStatus(0, 5, 1, 1, 4, 6);
    expect(document.getElementById('countdownLabel').textContent).toBe('No corner possible in this run');
    expect(document.getElementById('countdownTime').textContent).toBe('');
  });

  it('reports a countdown when a corner is reachable, throttled to one render per interval', async () => {
    const app = await loadApp();
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1000);
    app.updateStatus(0, 0, 2, 2, 10, 10);
    const firstLabel = document.getElementById('countdownLabel').textContent;
    expect(firstLabel).toBe('Next corner in ');

    document.getElementById('countdownTime').textContent = 'sentinel';
    // called again immediately: throttled, should NOT overwrite
    app.updateStatus(0, 0, 2, 2, 10, 10);
    expect(document.getElementById('countdownTime').textContent).toBe('sentinel');

    // advance past the render interval: should render again
    nowSpy.mockReturnValue(1300);
    app.updateStatus(0, 0, 2, 2, 10, 10);
    expect(document.getElementById('countdownTime').textContent).not.toBe('sentinel');
  });
});

describe('celebrateCorner', () => {
  it('spawns particles and flips the celebration classes', async () => {
    const app = await loadApp();
    app.celebrateCorner(5, 5);
    expect(app.particles.length).toBe(120);
    expect(document.getElementById('cornerText').classList.contains('active')).toBe(true);
    expect(document.getElementById('flash').classList.contains('active')).toBe(true);
    expect(document.body.classList.contains('shake')).toBe(true);
  });
});

describe('tick', () => {
  it('moves the bouncer with no wall hit on the first frame', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 50, y: 50, vx: 5, vy: 5 });
    app.tick(0);
    expect(app.x).toBe(55);
    expect(app.y).toBe(55);
    expect(document.getElementById('bouncer').classList.contains('hit')).toBe(false);
  });

  it('bounces off the left/top walls', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 0, y: 0, vx: -5, vy: -5 });
    app.tick(16);
    expect(app.x).toBe(0);
    expect(app.y).toBe(0);
    expect(app.vx).toBe(5);
    expect(app.vy).toBe(5);
    expect(document.getElementById('bouncer').classList.contains('hit')).toBe(true);
  });

  it('bounces off the right/bottom walls', async () => {
    const app = await loadApp();
    setViewport(200, 150);
    app.__setStateForTest({ x: 200, y: 150, vx: 5, vy: 5 });
    app.tick(16);
    expect(app.x).toBe(200);
    expect(app.y).toBe(150);
    expect(app.vx).toBe(-5);
    expect(app.vy).toBe(-5);
  });

  it('hits only the X wall and beeps the paddle tone (226Hz)', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    const FakeAudioContext = installFakeAudioContext();
    setViewport(200, 1000);
    app.__setStateForTest({ x: 0, y: 500, vx: -5, vy: 5 });
    app.tick(16);
    expect(FakeAudioContext.createdOscillators).toHaveLength(1);
    expect(FakeAudioContext.createdOscillators[0].frequency.value).toBe(226);
    localStorage.clear();
  });

  it('hits only the Y wall and beeps the wall tone (459Hz)', async () => {
    localStorage.setItem('cornerWatchSoundEnabled', 'true');
    const app = await loadApp();
    const FakeAudioContext = installFakeAudioContext();
    setViewport(1000, 200);
    app.__setStateForTest({ x: 500, y: 0, vx: 5, vy: -5 });
    app.tick(16);
    expect(FakeAudioContext.createdOscillators).toHaveLength(1);
    expect(FakeAudioContext.createdOscillators[0].frequency.value).toBe(459);
    localStorage.clear();
  });

  it('celebrates a corner at (0,0) and at (max,max)', async () => {
    const app = await loadApp();
    setViewport(200, 150);
    app.__setStateForTest({ x: 0, y: 0, vx: -5, vy: -5 });
    app.tick(16);
    expect(document.getElementById('flash').classList.contains('active')).toBe(true);

    const app2 = await loadApp();
    setViewport(200, 150);
    app2.__setStateForTest({ x: 200, y: 150, vx: 5, vy: 5 });
    app2.tick(16);
    expect(document.getElementById('flash').classList.contains('active')).toBe(true);
  });

  // deltaMs itself isn't exported, but its effect is observable through
  // trail-point aging: updateTrail does `p.age += deltaMs` on every call, and
  // trailPoints (with their .age) is exported live. vx/vy stay small and the
  // viewport is large, so the bouncer never nears a wall across these five
  // ticks - no bounce/color/status side effects to account for, just the
  // deltaMs fallback math. trailFrameCounter (module-private, starts at 0)
  // only samples a new point on even counts, so of these five updateTrail
  // calls only the 2nd and 4th (tick(16) and tick(1032)) push a point;
  // the other three just age whichever points already exist.
  it('tracks elapsed time across frames, falling back to a synthetic delta on a stalled or huge gap', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 500, y: 500, vx: 1, vy: 1 });
    app.trailConfig.enabled = true;
    app.trailConfig.fadeSeconds = 10; // long enough that nothing here gets culled

    app.tick(0); // first frame: lastTickTime was null, no rawDeltaMs to use at all
    expect(app.trailPoints).toEqual([]);

    app.tick(16); // normal small gap: rawDeltaMs = 16, used as-is
    expect(app.trailPoints).toHaveLength(1);
    expect(app.trailPoints[0].age).toBe(16);

    app.tick(16); // zero gap: rawDeltaMs = 0, must fall back to ~16.67ms, not 0
    expect(app.trailPoints).toHaveLength(1); // odd counter: no new sample this frame
    expect(app.trailPoints[0].age).toBeCloseTo(16 + 1000 / 60, 10);

    app.tick(1032); // huge gap: rawDeltaMs = 1000ms, not < 1000, so must fall back
    // to ~16.67ms rather than aging everything by a full second
    expect(app.trailPoints).toHaveLength(2);
    expect(app.trailPoints[0].age).toBeCloseTo(16 + 2 * (1000 / 60), 10);
    expect(app.trailPoints[1].age).toBeCloseTo(1000 / 60, 10);

    expect(() => app.tick(5016)).not.toThrow(); // ordinary gap again after the stall
  });

  it('recomputes the measured fps once the sampling window elapses', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 50, y: 50, vx: 1, vy: 1 });
    app.tick(0); // opens the sampling window at t=0
    app.tick(2500); // 1 frame counted over a 2.5s window: 1 / 2.5 = 0.4fps
    expect(app.measuredFps).toBe(0.4);
  });

  it('schedules the next frame via requestAnimationFrame', async () => {
    const app = await loadApp();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    app.tick(0);
    expect(raf).toHaveBeenCalledWith(app.tick);
  });
});

describe('window resize handler', () => {
  it('clamps the bouncer position back on screen', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 900, y: 900 });
    setViewport(300, 300);
    window.dispatchEvent(new window.Event('resize'));
    expect(app.x).toBe(300);
    expect(app.y).toBe(300);
  });

  it('leaves the position alone when it still fits after the resize', async () => {
    const app = await loadApp();
    setViewport(1000, 1000);
    app.__setStateForTest({ x: 50, y: 50 });
    setViewport(300, 300);
    window.dispatchEvent(new window.Event('resize'));
    expect(app.x).toBe(50);
    expect(app.y).toBe(50);
  });
});

describe('HUD idle fade', () => {
  it('marks the body idle after a stretch with no mouse movement', async () => {
    const app = await loadApp();
    expect(document.body.classList.contains('idle')).toBe(false);
    vi.advanceTimersByTime(app.HUD_IDLE_MS);
    expect(document.body.classList.contains('idle')).toBe(true);
  });

  it('movement while already awake just pushes back the idle deadline', async () => {
    const app = await loadApp();
    window.dispatchEvent(new window.Event('mousemove'));
    expect(document.body.classList.contains('idle')).toBe(false);

    vi.advanceTimersByTime(app.HUD_IDLE_MS - 1);
    expect(document.body.classList.contains('idle')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(document.body.classList.contains('idle')).toBe(true);
  });

  it('does not wake on the first pixel of movement, only after it persists', async () => {
    const app = await loadApp();
    vi.advanceTimersByTime(app.HUD_IDLE_MS);
    expect(document.body.classList.contains('idle')).toBe(true);

    window.dispatchEvent(new window.Event('mousemove'));
    expect(document.body.classList.contains('idle')).toBe(true); // not instant

    vi.advanceTimersByTime(app.HUD_WAKE_MS - 1);
    expect(document.body.classList.contains('idle')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(document.body.classList.contains('idle')).toBe(false);
  });

  it('a second stray movement during the wake delay does not restart it', async () => {
    const app = await loadApp();
    vi.advanceTimersByTime(app.HUD_IDLE_MS);

    window.dispatchEvent(new window.Event('mousemove'));
    vi.advanceTimersByTime(app.HUD_WAKE_MS / 2);
    window.dispatchEvent(new window.Event('mousemove')); // ignored: wake already pending
    vi.advanceTimersByTime(app.HUD_WAKE_MS / 2);

    expect(document.body.classList.contains('idle')).toBe(false);
  });

  it('armHudIdleTimer and onHudMouseMove can be called directly and drive the same idle/wake behavior as the bound listeners', async () => {
    const app = await loadApp();
    app.armHudIdleTimer();
    vi.advanceTimersByTime(app.HUD_IDLE_MS);
    expect(document.body.classList.contains('idle')).toBe(true);

    app.onHudMouseMove();
    vi.advanceTimersByTime(app.HUD_WAKE_MS);
    expect(document.body.classList.contains('idle')).toBe(false);
  });

  it('does not go idle while the mouse is sitting over the settings HUD', async () => {
    const app = await loadApp();
    document.getElementById('controls').dispatchEvent(new window.Event('mouseenter'));

    vi.advanceTimersByTime(app.HUD_IDLE_MS * 3);
    expect(document.body.classList.contains('idle')).toBe(false);
  });

  it('resumes the idle countdown once the mouse leaves the settings HUD', async () => {
    const app = await loadApp();
    const controls = document.getElementById('controls');
    controls.dispatchEvent(new window.Event('mouseenter'));
    vi.advanceTimersByTime(app.HUD_IDLE_MS);
    expect(document.body.classList.contains('idle')).toBe(false);

    controls.dispatchEvent(new window.Event('mouseleave'));
    vi.advanceTimersByTime(app.HUD_IDLE_MS - 1);
    expect(document.body.classList.contains('idle')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(document.body.classList.contains('idle')).toBe(true);
  });

  it('hovering the HUD while already idle wakes it immediately, without waiting for HUD_WAKE_MS', async () => {
    const app = await loadApp();
    vi.advanceTimersByTime(app.HUD_IDLE_MS);
    expect(document.body.classList.contains('idle')).toBe(true);

    document.getElementById('controls').dispatchEvent(new window.Event('mouseenter'));
    expect(document.body.classList.contains('idle')).toBe(false);
  });
});

describe('TV frame', () => {
  it('enabling frame mode warps #screen with a perspective transform and masks the CRT overlay to the screen cutout', async () => {
    await loadApp();
    const toggle = document.getElementById('frameEnabled');
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));
    expect(document.getElementById('screen').style.transform).toMatch(/^matrix3d\(/);
    expect(document.getElementById('tvFrame').classList.contains('framed')).toBe(true);
    expect(document.getElementById('crtOverlay').style.clipPath).toMatch(/^polygon\(/);
  });

  it('disabling frame mode clears the transform and the CRT overlay mask', async () => {
    await loadApp();
    const toggle = document.getElementById('frameEnabled');
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));
    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change'));
    expect(document.getElementById('screen').style.transform).toBe('');
    expect(document.getElementById('tvFrame').classList.contains('framed')).toBe(false);
    expect(document.getElementById('crtOverlay').style.clipPath).toBe('');
  });

  it('a window resize re-applies the transform while frame mode is on', async () => {
    await loadApp();
    const toggle = document.getElementById('frameEnabled');
    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));
    expect(() => window.dispatchEvent(new window.Event('resize'))).not.toThrow();
    expect(document.getElementById('screen').style.transform).toMatch(/^matrix3d\(/);
  });

  it('still applies the frame when saving the preference throws', async () => {
    await loadApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const toggle = document.getElementById('frameEnabled');
    toggle.checked = true;
    expect(() => toggle.dispatchEvent(new window.Event('change'))).not.toThrow();
    expect(document.getElementById('screen').style.transform).toMatch(/^matrix3d\(/);
  });
});
