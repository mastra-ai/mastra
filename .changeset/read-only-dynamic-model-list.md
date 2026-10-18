---
'@mastra/server': patch
'@mastra/client-js': patch
'@internal/playground': patch
---

The agent response now includes `modelListEditable`, which is `false` when the agent's `model` is a function and `true` for a static model list. Studio's Models panel uses it to show a function-valued list read-only, without drag handles, model pickers or enable switches, plus a note that the list is set in code.
