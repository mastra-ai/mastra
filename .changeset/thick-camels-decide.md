---
'@mastra/core': patch
---

Fix raw base64 image strings being wrapped in data URI in to-prompt.ts, causing Gemini inline_data. data rejection when using with Mastra
