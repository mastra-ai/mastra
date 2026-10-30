---
'@mastra/core': patch
---

Workspace tools now save their `data-workspace-metadata` chunks to the current response message. Previously, after a task signal rotated the response message id, the chunk was saved under the previous id and replaced that assistant message, losing its reasoning, text, and tool calls from stored history.
