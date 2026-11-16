---
'@mastra/valkey-streams': patch
'@mastra/redis-streams': patch
'@mastra/code-sdk': patch
---

Durable agent runs on this transport are no longer reported as lost when a lease renewal lands after the run suspends. The transport now tells `@mastra/core` that it hands a lease from one owner to the next in a single step, which the fix for [#30206](https://github.com/mastra-ai/mastra/issues/30206) needs before it trusts a release.
