---
'mastra': patch
---

`mastra build` now writes the resolved `@mastra/*` package versions to `.mastra/output/mastra-packages.json`, so a deployed server can report what it runs. The Factory UI bundled with the CLI shows them under **Settings › Debug**, with a button that copies the list for bug reports.
