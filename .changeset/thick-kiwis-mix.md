---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed a dev watch-mode build race in `@mastra/react` that could break dependent package type-checking with missing module errors. Watch mode now keeps existing `dist/` output and updates files in place; non-watch builds still clean output first.
