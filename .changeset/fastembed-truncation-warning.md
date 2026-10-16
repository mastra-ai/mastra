---
'@mastra/fastembed': patch
---

Added a truncation warning to the FastEmbed AI SDK v3 models.

The models now warn when an input exceeds the 512-token window. Before, FastEmbed dropped the extra text without notice. Split long text into smaller chunks to embed all of it.
