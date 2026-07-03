---
'@mastra/memory': patch
'@mastra/core': patch
---

Reduced message storage size by removing duplicated payloads at rest. Large tool-result payloads that also appear in a tool's toModelOutput mapping are now stored once and rehydrated on read, and file attachments are no longer stored twice (once as file parts and once as experimental_attachments). Existing stored messages are read back unchanged — no migration needed.
