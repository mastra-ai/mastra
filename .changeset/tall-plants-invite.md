---
'@mastra/core': patch
---

Fixed file attachments carrying AI SDK v5 metadata failing to persist and keep their media type. File parts using the v5 shape are now read wherever stored messages are converted, so they save correctly and retain their content type instead of erroring out. Also fixed distinct file attachments being wrongly deduplicated when they carried this metadata.
