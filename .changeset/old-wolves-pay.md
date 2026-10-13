---
'@mastra/pg': patch
---

Use the optional core preview helper for span writes and list fallback. Preserve long custom previews, avoid payload reads for stored empty previews, and pass previews through when the core helper is unavailable.
