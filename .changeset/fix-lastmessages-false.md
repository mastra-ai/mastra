---
'@mastra/memory': patch
'@mastra/core': patch
---

fix: respect `lastMessages: false` in `recall()` to disable conversation history

Previously, when `lastMessages: false` was configured in Memory options, the `recall()` method would treat `false` as "no limit" (via the storage layer's `normalizePerPage`) and return ALL messages instead of returning none. This caused agents to retain full conversation history despite the user explicitly disabling it.

The fix ensures that when `lastMessages: false` is set via config (not overridden by an explicit `perPage` argument), `recall()` returns empty messages immediately. Direct callers can still pass `perPage: false` explicitly to get all messages (e.g., for displaying thread history in a UI).

Also fixes `getMemoryMessages` in Agent to not pass `perPage: false` to `recall()`, instead omitting the parameter so the config-based disabled detection works correctly.
