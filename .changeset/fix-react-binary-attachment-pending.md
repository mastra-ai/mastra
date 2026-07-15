---
'@mastra/react': patch
---

Fixed binary file attachments missing during live streaming in `useChat` when `enableThreadSignals` is enabled. Attachments sent as `Uint8Array` or `ArrayBuffer` now render in the optimistic pending bubble and stay visible after the signal echo, without requiring a page refresh.
