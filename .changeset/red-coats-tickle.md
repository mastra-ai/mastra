---
'@mastra/core': minor
---

Added `delegation.enableResultReferences` so a later subagent delegation can reuse an earlier subagent's result verbatim through the new `contextFromRefs` tool input, instead of the supervisor restating it. Each subagent result gets a `[ref: <id>]` line the supervisor can pass along. Off by default. Closes https://github.com/mastra-ai/mastra/issues/22910
