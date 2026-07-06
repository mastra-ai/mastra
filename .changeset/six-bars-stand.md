---
'mastracode': minor
---

Run the MastraCode web server through the Mastra CLI so `mastra dev`, `mastra build`, `mastra deploy`, and `mastra start` all serve the same API surface from `src/mastra/index.ts`. The separate hand-wired local server was removed, and the web UI is now hosted separately and talks to the API cross-origin.
