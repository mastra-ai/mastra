---
'@mastra/core': patch
---

Fix `buildMessagesFromChunks` to preserve semantic stream order. Previously the `parts` array followed end-event timing, so when `text-end` arrived before `reasoning-end` the reasoning part was emitted after the text even though its first delta arrived first — confusing downstream prompt assembly. Each text and reasoning span now reserves its slot at first-seen-delta (or at start for redacted reasoning) and fills the slot at end. Closes #15914.
