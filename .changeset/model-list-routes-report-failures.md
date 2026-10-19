---
'@mastra/server': patch
---

Fixed the Studio Models panel reporting success when edits were silently dropped. The model list reorder and update routes now return 409 when the agent's `model` is a function (dynamic lists cannot be edited), and 400/404 when an edit cannot be applied, instead of always returning 200.
