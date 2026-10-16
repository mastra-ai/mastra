---
'@mastra/fastembed': patch
---

FastEmbed embedding models now return a warning when inputs exceed the model's 512-token window and are truncated. Previously the text past the limit was silently dropped from the embedding, so long chunks could not be found by their later content.
