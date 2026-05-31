---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed reasoning blocks disappearing after reloading a chat thread. Persisted reasoning is stored with an empty `reasoning` field and the text inside `details`; Studio now falls back to `details` so the reasoning stays visible after a refresh.
