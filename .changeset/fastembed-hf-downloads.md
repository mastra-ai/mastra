---
'@mastra/fastembed': patch
---

Built-in FastEmbed models now download from Hugging Face (Qdrant organization) instead of the legacy Qdrant Google Cloud Storage bucket, which is being shut down. Existing local model caches keep working.
