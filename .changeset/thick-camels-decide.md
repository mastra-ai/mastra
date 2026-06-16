---
'@mastra/core': patch
---

Fixed base64-encoded images failing when sent to Gemini through withMastra. Images now reach the provider in the correct format, matching the behavior of calling generateText without withMastra.
