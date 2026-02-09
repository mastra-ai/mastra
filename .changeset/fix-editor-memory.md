---
'@mastra/editor': patch
---

Fix memory persistence:

- Fixed memory persistence bug by handling missing vector store gracefully
- When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
- Fixed type compatibility for `embedder` field when creating agents from stored config
