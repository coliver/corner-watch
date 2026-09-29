---
name: demo-gif
description: Generate a short, seamlessly-looping demo GIF of the bouncing logo for the README (e.g. "make a new demo gif", "record the plain view", "update the screenshots"). Use this instead of re-deriving the approach from scratch.
---

# Demo GIF generation

Produces a small looping GIF of the screensaver for `README.md` (e.g.
`plain-view-loop.gif`). This is harder than it looks because the bounce is
literal physics with a random per-hit color, not a canned animation — a
naive screen recording will not loop cleanly. Two techniques that seem
obvious both fail:

- **Boomerang (forward + reversed frames)**: looks *wrong*, not smooth.
  Bounce physics visibly reversing (logo "moonwalking" back the way it
  came) reads as an obvious glitch, not a loop.
- **Crossfade dissolve** (blend the last few frames into the first few):
  also looks bad here. This content is a single sharp flat-color graphic
  on a black background, not photographic texture — blending two
  different logo positions just produces a ghostly double-exposure, it
  doesn't read as a smooth dissolve.

The only approach that actually works: make the bounce **exactly,
mathematically periodic** over a short window, and capture only real
forward motion — one true period, no reversal, no blending.

## The technique

1. **Serve the app** (`python3 -m http.server 8934` from the repo root).

2. **Playwright**, with the `chromium` package resolved from wherever it's
   actually installed on this machine (check `npm root -g` and sibling
   project `node_modules` — it wasn't installed in this repo or globally
   last time, found in `~/code/job-thing/node_modules/playwright`).
   Don't write scratch scripts *into* that sibling project just to get
   ESM resolution to work from its directory — it's someone else's repo.
   Instead, resolve the package's absolute entry path with CommonJS
   `require.resolve(..., { paths: [...] })` pointed at its
   `node_modules`, then `import()` that absolute path from a script that
   lives anywhere (e.g. this repo's scratchpad):

   ```js
   import { createRequire } from 'node:module';
   import { pathToFileURL } from 'node:url';
   const require = createRequire(import.meta.url);
   const entry = require.resolve('playwright', {
     paths: ['/home/chris/code/job-thing/node_modules'],
   });
   const playwrightModule = await import(pathToFileURL(entry).href);
   const { chromium } = playwrightModule.default ?? playwrightModule;
   ```

   The resolved entry is CJS (`playwright/index.js`), so under Node's ESM
   interop the named exports (`chromium`, etc.) land on `.default`, not on
   the top-level module namespace — destructure from `.default` (fall back
   to the namespace itself in case a future playwright ships real ESM).

3. **Pick a box size and speed with an exact, corner-hit-free period.**
   The bouncer reflects off `maxX = innerWidth - logoWidth` and
   `maxY = innerHeight - logoHeight` (logo is a fixed 256x152 regardless
   of viewport). A trajectory starting exactly at a shared corner (0,0)
   with equal vx/vy *always* hits a corner (triggers the confetti/flash/
   shake celebration) at exactly the midpoint of its period — this
   contaminates the capture with celebration animation frames (visible as
   garbage fractional pixel positions when you log `getBoundingClientRect()`
   each frame). Fix: start on one wall but *off* the other wall
   (`x0 = 0, y0 = something not 0 or maxY`), and use different vx/vy so
   the two wall-hit cycles never land on the same tick. Brute-force this
   in plain Node (fast, no browser needed) by simulating the app's exact
   tick update rule and rejecting any (maxX, maxY, vx, vy, y0) combo that
   ever hits both walls on the same tick within one period:

   ```js
   function simulate(maxX, maxY, vx0, vy0, x0, y0, limit) {
     let x = x0, y = y0, vx = vx0, vy = vy0;
     const start = { x: x0, y: y0, vx: vx0, vy: vy0 };
     for (let t = 1; t <= limit; t++) {
       x += vx; y += vy;
       let hitX = false, hitY = false;
       if (x <= 0) { x = 0; vx = -vx; hitX = true; }
       else if (x >= maxX) { x = maxX; vx = -vx; hitX = true; }
       if (y <= 0) { y = 0; vy = -vy; hitY = true; }
       else if (y >= maxY) { y = maxY; vy = -vy; hitY = true; }
       if (hitX && hitY) return { corner: true, t };
       if (x === start.x && y === start.y && vx === start.vx && vy === start.vy) {
         return { period: t, corner: false };
       }
     }
     return { period: null };
   }
   ```

   Loop this over a handful of candidate `maxX`/`maxY`/`vx`/`vy`/`y0`
   values, keep the ones with `corner: false` and a short `period`
   (roughly 50-150 ticks is a good loop length). Last time:
   `maxX=180, maxY=130, vx=7, vy=5, y0=10` gave an exact 52-tick period.
   Viewport = `{ width: 256 + maxX, height: 152 + maxY }`.

4. **Freeze the accent color** for the capture (`html { --glow: #ff9500
   !important }` via `page.addStyleTag`) — the app picks a *random*
   palette color on every wall hit, which is irrelevant noise for a demo
   loop and would otherwise need matching too. Also hide the HUD
   (`#controls, #countdown { display: none !important }`, which covers
   `#settingsBtn` since it's nested inside `#controls`) so the settings
   button/countdown ticker don't clutter the recording.

   **Call `addStyleTag` *after* `page.goto`, not before.** Styles injected
   before navigation apply to the pre-navigation blank page and are
   discarded when the page actually loads — the hiding CSS silently never
   takes effect and every frame still shows the hamburger button/countdown
   tooltip, with no error to flag it. Always screenshot frame 1 and
   eyeball it before capturing the rest of the run.

5. **Kill the page's own animation loop and drive `tick()` manually** —
   this is the part that makes the loop *exact* rather than "pretty
   close". Real `requestAnimationFrame` timing has enough jitter
   (variable ticks per real millisecond) that screenshot-based sampling
   never lands on the same sub-pixel state twice, even when the
   underlying physics is genuinely periodic. Instead:

   ```js
   await page.evaluate(async () => {
     window.requestAnimationFrame = () => 0; // stop the natural RAF loop
     window.__cw = await import('/app.js');  // same cached module instance
     window.__cw.__setStateForTest({ x: 0, y: 10, vx: 7, vy: 5 });
   });
   await page.waitForTimeout(150); // let any already-in-flight frame settle
   await page.evaluate(() => window.__cw.__setStateForTest({ x: 0, y: 10, vx: 7, vy: 5 })); // wipe drift from that settling frame
   ```

   `app.js` exports internals (`tick`, `__setStateForTest`, ...) as named
   exports purely for the test suite (see `AGENTS.md`) — nothing in the
   app imports them, but an external script can still `import('/app.js')`
   and get the *same* live module instance (browsers cache ES modules by
   URL), so `__setStateForTest` mutates the exact state the real physics
   uses.

   Then step forward one tick at a time and screenshot after each:

   ```js
   for (let i = 0; i < period; i++) {
     await page.evaluate(() => { window.__cw.tick(performance.now()); });
     await page.screenshot({ path: `frame${i}.png` });
   }
   ```

   Capture **exactly `period` frames representing ticks 1..period**, not
   0..period-1 — the very first state (tick 0, right after
   `__setStateForTest`) never gets rendered to the DOM because nothing
   repaints the bouncer's `transform` until a real `tick()` call runs (RAF
   is dead). Skip it; ticks 1..period is a complete, cleanly-rendered
   period, and since tick(period) == tick(0) by construction, the last
   frame flows into the first with exactly one normal tick-step of
   motion — genuinely seamless.

6. **Assemble the GIF.** More frames at a low color count beats fewer
   frames at a high color count — this content is mostly flat black, so
   temporal resolution is nearly free but per-pixel noise is not:

   ```
   ffmpeg -framerate 20 -i f%03d.png \
     -vf "scale=436:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=16[p];[s1][p]paletteuse=dither=none" \
     -loop 0 output.gif
   ```

   - `dither=none` matters a lot here: this is flat vector-style color,
     not a photo, and dithering adds pixel noise that fights GIF's LZW
     compression for no visual benefit. Dropping it shrank a test file
     from 477KB to 373KB at the same frame count/colors.
   - `-loop 0` is already infinite looping (GIF spec); no need to touch
     it. Verify with:
     `python3 -c "d=open('f.gif','rb').read(); i=d.find(b'NETSCAPE2.0'); print(d[i+11:i+16].hex())"`
     — should end in `0000` (loop count 0 = infinite).
   - 16-24 colors is plenty for this content (solid fills, no gradients);
     went as low as 16 with no visible banding.

7. **Verify before installing.** Don't trust `identify -format ...`/
   `convert file.gif[N]` on a single frame index — animated GIFs are
   often frame-diffed (later frames only contain the changed region), so
   extracting one raw frame shows an un-composited partial image (looks
   like a white/broken background even though playback is fine). Always
   `convert file.gif -coalesce out_%03d.png` first to fully composite
   each frame, *then* inspect.

## Gotchas hit last time (in order encountered)

- `ffmpeg`+`gifsicle` aren't npm deps; they're already on the system
  (`/usr/bin/ffmpeg`, `/usr/bin/convert`). Playwright's browsers were
  already cached at `~/.cache/ms-playwright/` even though the `playwright`
  npm package itself wasn't installed anywhere obvious — had to find a
  sibling project with it in `node_modules` and run node from there.
- Recording via Playwright's `recordVideo` (webm) and converting with
  ffmpeg produced a spurious white-background flash in some frames — a
  FOUC-timing artifact of the video capture path. Switched to direct
  `page.screenshot()` per frame instead, which doesn't have this problem.
- The logo isn't plain colored text — it's an `<img>`-derived white
  silhouette (`image.png`) tinted via a CSS mask (`.tint` element,
  `background-color`), per `README.md`'s Files section. Reading
  `getComputedStyle(bouncer).color` (text color) instead of the `.tint`
  element's `background-color` silently returns black for every frame.
