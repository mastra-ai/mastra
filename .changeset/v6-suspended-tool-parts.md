---
'@mastra/core': patch
---

Fixed suspended tool calls losing their suspension details when stored messages are converted to AI SDK v6 or v7 UI messages. `toAISdkMessages(messages, { version: 'v6' })` and `{ version: 'v7' }` now include the `data-tool-call-suspended` part (with the suspend payload and resume schema), matching the v5 output, so suspended tools stay resumable after a page reload.
