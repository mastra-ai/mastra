---
'mastra': patch
'@mastra/factory': patch
---

`mastra build` now writes `mastra-packages.json` (the resolved `@mastra/*` package versions) into `.mastra/output`, so deployed servers can report what they run. The Factory serves this list at `GET /web/config/versions`, and the Factory UI shows it under **Settings › About** with a button that copies it for bug reports.
