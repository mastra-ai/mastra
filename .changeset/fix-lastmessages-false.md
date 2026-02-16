---
'@mastra/memory': patch
'@mastra/core': patch
---

fix: respect `lastMessages: false` in `recall()` to disable conversation history

Setting `lastMessages: false` in Memory options now correctly prevents `recall()` from returning previous messages. Previously, the agent would retain the full conversation history despite this setting being disabled.

Callers can still pass `perPage: false` explicitly to `recall()` to retrieve all messages (e.g., for displaying thread history in a UI).
