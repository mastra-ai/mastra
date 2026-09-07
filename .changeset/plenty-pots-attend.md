---
'@mastra/core': patch
---

Fixed crash recovery for durable and evented agents failing with `TypeError: Cannot read properties of undefined (reading 'messages')` — or `(reading 'length')` when the process died between iterations.

Running-history pruning removed `messageListState` / `accumulatedSteps` from every completed step of a `running` snapshot, but `restart()` reads completed step *outputs* back: the engine feeds a restarted step its predecessor's output, and the durable loop's `collect-tool-results` re-reads the LLM step's output after the tool-call foreach. So a crashed run could never be recovered — it failed in `durable-llm-execution` when the process died during the model call, in `durable-llm-mapping` when it died during a tool call, and in `durable-goal` when it died between iterations (where `onIterationComplete` hooks run), a gap in which the snapshot lists no active step at all.

A running snapshot now keeps exactly what restart reads: the step it re-executes is resolved from the graph position, keeps its payload, and the newest completed output before it keeps the conversation state. Every older copy is still pruned, so duplication stays constant in run length.

```ts
// Recovers again instead of throwing on the first step.
const recovered = await agent.recover(runId);
```
