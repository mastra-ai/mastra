---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `toolResult` as a recognized processor phase across the processor server API and the generated client types. Processors that implement `processToolResult` are now detected and surfaced when listing processors, the phase can be targeted when executing a processor, and it is accepted by the processor provider and stored agent schemas. The `@mastra/client-js` route types now include the new phase.
