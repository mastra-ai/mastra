---
'@mastra/core': minor
---

Added `detach()` to `DurableAgent.observe()` so an observer can stop watching a run without affecting it. Leaving the `for await` loop over `fullStream` early (`break`, `return`, or a thrown error) now also detaches, instead of keeping the subscription open for the life of the process.

```ts
const { output, detach } = await agent.observe(runId);
request.signal.addEventListener('abort', detach, { once: true });
if (request.signal.aborted) detach();

for await (const chunk of output.fullStream) {
  send(chunk);
}
```

`cleanup()` is unchanged. It still removes the run and its cached events, so only the process that owns the run should call it.

**Behavior change:** when `idleTimeoutMs` fires without an `isAlive` probe, the observer now detaches, and the run's registry entry and cached events are kept. Before, a quiet but still-running run (for example, one waiting on a slow tool) was cleaned up. If you rely on the idle timeout to clean up runs whose process crashed, pass `isAlive` so the run is only cleaned up when it reports the run is no longer running.
