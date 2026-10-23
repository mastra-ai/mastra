---
'@mastra/inngest': patch
---

Brought Inngest durable agents (`createInngestAgent`) in line with core's durable agent. These features already worked with `DurableAgent` but were missing or broken on Inngest:

- `observe()` now returns `detach()`, accepts `idleTimeoutMs` and `isAlive`, closes at once when the run already finished, and stays open across suspends and through an abort until the run's abort finish. Fixes #28175.
- `modelSettings.timeout.totalMs` now stops the run at the deadline instead of waiting for a stuck tool.
- Output processors (`processOutputStream`, `processOutputResult`, output step processors) now run on Inngest agent streams, including a resumed stream in the process that started the run. A resume in a process that never ran the stream (cold resume) still runs without them.
- `isTaskComplete` scorers and agent goals are now checked on each iteration.
- Calling `abort()` (on the stream or on an `observe()` handle) on a run parked on a tool approval or suspension now releases it, so a later resume is rejected.
- Reserved request-context memory keys now take priority over the `memory` option, as on `DurableAgent`.
- `approveToolCall` and `resumeStream` now run the tool, and the resumed stream's output processors, with the request context you pass, not the one the run suspended with.
- `stopWhen` now gets the same step content as `stream.steps`.
- A resumed stream's `toolCalls` now includes the resumed call, `generateTitle.emitEvent` streams the title, step `response.messages` is populated, and a processor retry no longer drops the earlier tool call from the prompt.

```ts
const observation = await agent.observe(runId, { idleTimeoutMs: 30_000 });

for await (const chunk of observation.fullStream) {
  if (chunk.type === 'finish') break;
}

// Stop listening without aborting the run.
observation.detach();
```
