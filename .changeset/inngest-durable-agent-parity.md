---
'@mastra/inngest': minor
'@mastra/core': patch
---

Bring `InngestAgent` (Inngest-backed durable agent) to parity with `DurableAgent` for per-call execution options, abort handling, idle-aware resume, and `generate()`.

`InngestAgent.stream()` and `resume()` now accept the same execution-option surface as `DurableAgent`, including `stopWhen`, `activeTools`, `structuredOutput`, `versions`, `system`, `disableBackgroundTasks`, `tracingOptions`, `actor`, `transform`, `prepareStep`, `isTaskComplete`, `delegation`, function-form `requireToolApproval`, and the lifecycle callbacks `onAbort` / `onIterationComplete`. Closure-shaped options (`prepareStep`, `transform`, function-form `isTaskComplete` / `requireToolApproval`, `stopWhen` callbacks) continue to work in-process; they degrade after a worker hop the same way they do for in-memory `DurableAgent`.

```ts
const result = await inngestAgent.stream(messages, {
  runId: 'run-1',
  abortSignal: controller.signal,
  stopWhen: stepCountIs(5),
  onIterationComplete: ({ iteration }) => console.log('done', iteration),
});

// Cancel a live run from the caller
result.abort();

// Resume and drive the run to completion in a single call
await inngestAgent.resume({ runId: 'run-1', resumeData, untilIdle: true });

// Durable equivalents of Agent.generate / resumeGenerate
const out = await inngestAgent.generate(messages, { runId: 'run-2' });
const resumed = await inngestAgent.resumeGenerate({ runId: 'run-2', resumeData });
```

`@mastra/core` re-exports `globalRunRegistry` and `runResumeDurableStreamUntilIdle` from `@mastra/core/agent/durable` so durable-agent integrations can share the same registry and idle-wrapper plumbing.
