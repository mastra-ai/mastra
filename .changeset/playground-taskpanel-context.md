---
'@mastra/playground': patch
---

TaskPanel now reads task state from `useChat().tasks` instead of rescanning all messages on every render. Fixes a build-breaking import from a deleted module.
