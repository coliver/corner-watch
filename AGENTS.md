# AGENTS.md

A DVD-logo screensaver: static site, no build step, no runtime dependencies.
`index.html` (markup), `styles.css` (styling), `app.js` (all behavior, ES
module). See `README.md` for feature/user-facing details.

## Running it

`app.js` is a module, so it must be served over `http(s)://`, not opened as
`file://`:

```
python3 -m http.server 8934
```

## Before considering a change done

```
npm test        # vitest, coverage enforced at 100% (statements/branches/functions/lines)
npm run lint     # eslint (flat config, eslint-plugin-unicorn + eslint-plugin-no-unsanitized)
```

Both must pass. 100% coverage means new branches in `app.js` need a covering
test in `test/app.test.js`, not just a passing suite.

## Conventions

- `app.js` exports its internal functions and some live state (see the
  object literal at the bottom of the file) purely so tests can call them
  directly — nothing in the app itself imports from that export. When
  adding a new function the tests need to reach, add it to that export list.
- No frameworks, no bundler, no `npm` deps at runtime — keep it that way.
  Dev-only tooling (test/lint) is fine in `package.json`.
- `eslint-plugin-unicorn` is strict (e.g. `prevent-abbreviations` rejects
  names like `src`/`dst`/`i`). A few rules are deliberately disabled with
  inline comments explaining why in `eslint.config.js` — read those before
  re-enabling or re-disabling anything there.
- `localStorage` is the only persistence; keys are all prefixed
  `cornerWatch*`. Nothing is sent over the network.
- The "TV frame" view (`#tvFrame`, toggled via the frame checkbox) renders
  `#screen` at normal full-viewport size as always, then visually
  perspective-warps it with a CSS `matrix3d` transform (computed by
  `solveHomography` in `app.js`) to sit inside the photographed CRT cutout
  in `tv-cart.png`, which is a trapezoid due to camera angle — not a plain
  scale/translate. The warp is purely cosmetic: bounce physics and corner-hit
  detection always run in the untransformed `window.innerWidth`/`innerHeight`
  space, so this transform can't affect corner-hit odds.
