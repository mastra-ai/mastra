---
'@mastra/react': patch
---

Fixed the first message of a new Studio chat showing twice until reload. When the saved thread loaded before the live stream confirmed the message, `useChat` kept both the pending copy and the saved one.
