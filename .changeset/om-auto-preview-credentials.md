---
'@mastra/code-sdk': patch
'mastracode': patch
---

`/om` now shows the same Auto memory model that runs use. Before, the preview only checked `GOOGLE_GENERATIVE_AI_API_KEY`, so with `GOOGLE_API_KEY` or a Google key saved with `mastracode login` it showed Claude Haiku while runs used Gemini Flash.
