---
'mastra': patch
---

Fixed `mastra migrate` guidance for monorepos and other custom layouts.

- Relative `--dir` now resolves from `--root` (or cwd if `--root` is not provided).
- When neither `src/mastra/index.ts` nor `src/mastra/index.js` is present, the CLI now prints actionable `--dir` and `--root` instructions instead of a raw file-missing error.
- The error message also includes detected `src/mastra/index.ts|js` candidates under the selected root to help users choose the correct path quickly.
