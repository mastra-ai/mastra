---
'@mastra/fastembed': patch
---

FastEmbed models now declare their 512-token input window, so semantic recall splits long messages into chunks that fit it instead of embedding only the first 512 tokens.
