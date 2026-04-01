---
'@internal/playground': patch
---

Fixed custom API prefix not displaying in Studio settings page. The prefix configured via MASTRA_API_PREFIX is now correctly passed to StudioConfigForm and preserved when saving settings. (https://github.com/mastra-ai/mastra/issues/14634)
