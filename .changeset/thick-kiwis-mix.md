---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed dev pipeline race in @mastra/react where `tsup --watch` wiped `dist/` on every restart, causing concurrent `tsc` in dependent packages (e.g. `@mastra/playground-ui`) to fail with `Cannot find module '@mastra/react'`. The watch mode now preserves `dist/` and updates files in place; non-watch builds still clean as before.
