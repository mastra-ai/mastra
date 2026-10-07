---
'@mastra/playground-ui': patch
---

Fixed the `ChatShell` composer bouncing with the transcript when you scroll past either end in Chrome, vertically or sideways. Nothing shows through behind or beside the composer anymore: the transcript fades out above it. The scroller also keeps the same room on both sides (`--chat-edge`, `0.5rem` by default), so its scrollbar never overlaps the composer and the column stays centred.
