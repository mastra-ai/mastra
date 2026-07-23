---
'mastra': patch
---

Serve the Factory UI during `mastra factory dev`. The prebuilt SPA bundled with the CLI was only copied into `public/factory` by `mastra build`, so in dev the SPA middleware never mounted and the browser fell back to the default Mastra Server page. Dev now points the server at the CLI-bundled UI via `MASTRACODE_UI_DIST`, unless the user set an explicit override or has a locally built UI at `public/factory`.
