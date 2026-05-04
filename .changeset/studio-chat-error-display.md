---
'@internal/playground': patch
---

Fix Studio chat swallowing API errors. When an agent stream emits an `error` chunk (or `sendMessage` throws), the resulting error message is now persisted in a state that survives the post-stream `initialMessages` refetch, so the chat UI consistently surfaces the failure instead of clearing it.
