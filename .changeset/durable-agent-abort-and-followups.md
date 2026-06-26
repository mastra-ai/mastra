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
