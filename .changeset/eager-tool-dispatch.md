---
'@mastra/core': patch
---

Tools now start as soon as their own arguments are complete, instead of waiting for the model to finish streaming the whole step. This is on by default and removes seconds of idle time from steps that call several tools.

```ts
// Default: each tool starts as soon as its call is complete.
const eager = await agent.stream('Compare the weather in Paris and Rome');

// Opt out to restore the previous scheduling.
const deferred = await agent.stream('Compare the weather in Paris and Rome', {
  eagerToolExecution: false,
});
```

These calls still wait for the model to finish: tools that need approval, declare a suspend schema, run on the provider or client, or run in the background, and runs that use the `called` concurrency strategy or output processors that run after the stream. A tool that already finished is never run again and its result is always kept, including on retry, fallback, and abort.

A tool still running when an attempt is retried, falls back, or is aborted finishes first, and its result is kept.

A tool that calls `suspend()` at runtime also runs once: the run suspends instead of retrying the model. See the `stream()` reference for the full rules.
