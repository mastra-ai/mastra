---
'@mastra/core': patch
---

Fix crash in AIV4/AIV5 adapter `toUIMessage` when file part data is binary (Uint8Array/ArrayBuffer) or a URL object instead of a string. This can happen when processing attachments from channel adapters (e.g. video/audio files from Discord, Slack).
