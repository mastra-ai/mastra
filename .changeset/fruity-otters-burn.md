---
'mastra': patch
---

Fixed `mastra migrate` guidance for monorepos and other custom layouts.

- Relative `--dir` now resolves from `--root` (or cwd if `--root` is not provided).
- When `src/mastra/index.ts` is missing, the CLI now prints actionable `--dir` and `--root` instructions instead of a raw file-missing error.
- The error message now includes detected `src/mastra/index.ts|js` candidates under the selected root to help users choose the correct path quickly.
