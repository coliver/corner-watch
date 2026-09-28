import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
export const bodyHtml = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');

// Restores the page to a fresh-load DOM state. Used both here (first load)
// and by tests (before each one, so mutations from the previous test - a
// swapped-in photo, a toggled class, a resized canvas - don't leak over).
export function resetDom() {
  document.body.innerHTML = bodyHtml;
  document.body.className = '';
}
resetDom();

// jsdom has no real canvas backend; app.js only ever calls a fixed, small set
// of drawing methods and never reads pixels back, so a no-op stub is enough
// to let the trail/particle drawing code run without throwing.
function makeStubContext() {
  return {
    clearRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}
window.HTMLCanvasElement.prototype.getContext = () => makeStubContext();

// jsdom doesn't load real images. This fake fires a real 'load' event (via
// EventTarget, matching app.js's `addEventListener('load', ...)`) on the
// next microtask - mirroring real async image decode - with a configurable
// natural size, which is all app.js's probe image needs. Tests can reassign
// `global.Image` again beforehand to exercise a different size.
class FakeImage extends EventTarget {
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
global.Image = FakeImage;

// app.js kicks off its requestAnimationFrame(tick) loop immediately on
// import. Fake timers (which also cover rAF) make that loop deterministic:
// nothing runs until a test explicitly advances the clock.
vi.useFakeTimers();
