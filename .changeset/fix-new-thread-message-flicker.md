---
'@mastra/react': patch
---

Fix a race condition in the `useChat` hook where the first assistant message on a new thread would flash and then disappear. When a stream finishes, `refreshThreadList` triggers navigation to the persisted thread URL. The `useAgentMessages` query immediately fetches and can receive an empty result if the backend hasn't finished persisting messages yet. The resulting empty `initialMessages` prop caused `setMessages([])` to overwrite streamed messages that were still visible. The hook now skips the reset when `initialMessages` resolves to an empty list but there are already messages in local state — thread switches are unaffected because they remount the component via a `key` prop change.
