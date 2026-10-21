---
'@mastra/core': patch
---

Fixed durable and evented agent streams dropping provider metadata from successful tool-result chunks, including sub-agent text output mappings, while preserving original tool-call metadata in payload-transform callbacks.
