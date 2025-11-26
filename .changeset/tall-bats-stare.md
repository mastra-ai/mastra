---
'@mastra/core': patch
---

Fix message-list conversion issues when persisting messages before tool suspension: filter internal metadata fields (`__originalContent`) from UI messages, keep reasoning field empty for consistent cache keys during message deduplication, and only include providerMetadata on parts when defined.
