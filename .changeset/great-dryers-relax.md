---
'@mastra/core': patch
---

Fixed `run.cancel()` leaving a workflow's spans open when a step ignores `abortSignal`.

A step that never observes the abort signal keeps running, so the execution engine never unwinds and never ends the run's spans. Exporters that only act on span-end events (Langfuse, Mastra Cloud, and any OpenTelemetry-based exporter) therefore never received the run span or any of its ancestors, leaving traces without input/output, tags, or cost, and turning every step that did finish into an orphan. `cancel()` now closes the run's span tree itself, on both the default and evented engines.

```ts
const run = await workflow.createRun();
run.start({ inputData: {} });

// The trace is now closed and exported even if the running step never returns
await run.cancel();
```
