---
'@mastra/core': patch
---

Fixed durable agents (`createInngestAgent`) so resuming a run that suspended inside a tool delivers the resume payload to that tool and drives the run to completion. A resumed invocation re-emits the terminal step-update for every entry it replays, and in durable engines those operation IDs collided with the memoized writes from the original invocation — for the suspended step that tripped `AUTOMATIC_PARALLEL_INDEXING` and dropped the resume payload, leaving the run suspended forever. The resumed lineage's persists now carry a `resume` phase so their operation IDs stay distinct.

Pairs with the nested resume-path restoration in #19752.

```ts
const durableAgent = createInngestAgent({ agent, inngest });

// suspends inside a tool that calls suspend()
const { runId } = await durableAgent.stream(messages, { runId });

// now delivers { approved: true } to the suspended tool and finishes the run
await durableAgent.resume(runId, { approved: true });
```
