---
'@mastra/memory': patch
---

Fixed Observational Memory writing observation markers onto messages that were never observed. When you call `observe({ messages })` with only part of a thread, the marker is now anchored to the last message in that set instead of the newest assistant message in the thread, so unobserved messages still appear in the next prompt. Fixes #21657
