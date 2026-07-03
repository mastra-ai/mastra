---
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

Fixed Studio HTML config injection so platform environment values are escaped before they are embedded in served or deployed `index.html` files. This keeps organization IDs, project IDs, observability endpoints and telemetry flags intact when they contain quotes, angle brackets, newlines or `$` sequences, and exposes `escapeStudioHtmlValue` from `@mastra/deployer/build` for the shared injection paths.
