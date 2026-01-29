---
'mastra': patch
---

Improved peer dependency version mismatch warnings in the CLI:

- When the dev server crashes with an error, a hint is now shown suggesting that updating mismatched packages may fix the issue
- The update command now uses the correct package manager (pnpm/npm/yarn) detected from lockfiles
- The update command uses `add @package@latest` instead of `update` to ensure major version updates are applied
