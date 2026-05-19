---
'@mastra/core': patch
---

Fixed `filterMessagesForPersistence` in the `MessageHistory` processor unconditionally trimming each text part. Since PR #15454, stream chunks are stored as one text part per text-start/text-end span (e.g., `"I have"`, `" access"`, `" to"`), so the per-part `.trim()` dropped token-boundary whitespace and broke word reconstruction on recall (`"I haveaccessto..."`). Trim now only runs when `removeWorkingMemoryTags` actually stripped tag content; the same guard is applied to the string-content branch for consistency. Fixes #15880.
