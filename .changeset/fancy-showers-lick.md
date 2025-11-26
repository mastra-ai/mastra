---
'@mastra/inngest': patch
---

Fixes an issue where workflow step failures weren't emitting `workflow-step-result` events in the catch block, preventing proper failure tracking. Also improved error details by including full stack traces instead of just error messages.
