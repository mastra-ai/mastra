---
'@mastra/memory': patch
---

Fixed token counting crashing with `TypeError: invocation.errorText?.trim is not a function` when stored conversation history contains a failed tool call whose `errorText` is an object instead of a string. The error is now serialized and counted, so one such message no longer stops Observational Memory from running on later turns. Fixes #28407.
