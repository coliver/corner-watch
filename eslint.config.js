import globals from 'globals';
import unicorn from 'eslint-plugin-unicorn';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  {
    files: ['app.js'],
    ...unicorn.configs['flat/recommended'],
  },
  {
    files: ['app.js'],
    ...noUnsanitized.configs.recommended,
  },
  {
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // getElementById-by-id is the clearest, most direct way to select a
      // single known element and is marginally faster; querySelector('#id')
      // everywhere would be pure churn, not a real improvement here.
      'unicorn/prefer-query-selector': 'off',
      // `null` is used throughout to mean "intentionally empty/cleared"
      // (matching localStorage.getItem()'s own return contract, and the
      // conventional meaning of null in DOM/browser APIs), which is a
      // legitimate, widely-used convention distinct from "unset" (undefined).
      'unicorn/no-null': 'off',
      // This is a browser-only page, never isomorphic/worker code, so
      // `window` is the clearer signal to a reader that a reference is
      // browser-scoped; globalThis adds no real value here.
      'unicorn/prefer-global-this': 'off',
      // tick()'s one else-if chain branches on compound conditions across
      // two different booleans (hitX && hitY / hitX / hitY), not a
      // discriminated switch over a single value - `switch (true)` would be
      // the recognized anti-pattern here, not an improvement.
      'unicorn/prefer-switch': 'off',
    },
  },
  {
    files: ['test/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
