---
'@mastra/core': minor
---

Finished closing the gap between `DurableAgent` and `Agent`. After this change the durable agent surface mirrors the in-process agent's stream, resume, and generate APIs.

**What's new**

- `abortSignal` on `stream()` and `resume()`, plus `result.abort()` on `stream()`, `resume()`, and `observe()`. `result.abort()` on `streamUntilIdle()` fans out to every inner run.
- `untilIdle` on `resume()` (it already existed on `stream()`), using the shared `runWithIdleWrapper` so both paths drive the same idle loop.
- `DurableAgent.generate()` and `DurableAgent.resumeGenerate()` wrap `stream()` / `resume()` and resolve a `FullOutput` even when the run suspends mid-flight.
- `delegation` callbacks (`onDelegationStart`, `onDelegationComplete`, `messageFilter`) are forwarded to `convertTools` at prepare time and baked into sub-agent tool wrappers.
- Per-call `clientTools` and `toolsets` survive in-process resume via the run registry (cross-process resume still falls back to the agent's static tools).
- Scorers configured on the wrapped agent or passed per call now actually execute under durable runs and emit `ON_SCORER_RUN` payloads matching the non-durable shape.
- `AGENT_RUN` spans now carry `conversationId`, `instructions`, `resolvedVersionId`, `entityVersionId`, and the agent's `tracingPolicy`. Resume spans use `'agent run: <id> (resumed)'` and include `resumedFromSpanId`.

**Example**

```ts
import { createDurableAgent } from '@mastra/core/agent/durable';

const durable = createDurableAgent({ agent: myAgent });

// 1. generate() — drains a durable run to a single FullOutput
const out = await durable.generate('Plan a week in Lisbon', {
  abortSignal: controller.signal,
  modelSettings: { temperature: 0.2 },
});

// 2. stream() with result.abort() — cancel mid-run
const result = await durable.stream('Long research task');
setTimeout(() => result.abort(), 5_000);
for await (const chunk of result.output.fullStream) {
  process.stdout.write(chunk.payload?.text ?? '');
}

// 3. Suspend → resumeGenerate() round-trip (e.g. tool approval)
const first = await durable.generate('Run the dangerous tool', {
  requireToolApproval: true,
});
if (first.finishReason === 'suspended') {
  const final = await durable.resumeGenerate(first.runId!, { approved: true });
  console.log(final.text);
}

// 4. resume({ untilIdle }) — drive a resume through to a quiescent state
await durable.resume(runId, resumeData, { untilIdle: true });
```
