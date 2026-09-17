---
'@mastra/core': patch
---

Start a tool as soon as its own arguments are complete, instead of waiting for the model's streaming step to finish. Previously a tool whose arguments had fully arrived still waited on later sibling calls and trailing content, which cost seconds of dead time on every step that called a tool. `agent.stream()` now dispatches an eligible server-side tool call the moment it is complete, while the model keeps streaming, and the existing pipeline still owns result ordering and message history.

```ts
// A tool call completes early in the step; its execution no longer waits for
// the rest of the model's output.
const stream = await agent.stream('Compare the weather in Paris and Rome');

// Opt out to restore the previous scheduling.
const stream = await agent.stream('Compare the weather in Paris and Rome', {
  eagerToolExecution: false,
});
```

Eligibility is narrow by design: approval-gated, suspendable, provider-executed, client-side, background-dispatched (by argument or by config), auto-resumed, missing and inactive tools keep the previous behaviour, as does any run configured with `toolCallConcurrency.strategy: 'called'` or with an output processor that runs after the stream. A caller abort cancels work already running, and durable agents reject the option.

Eager work honours the same configured concurrency limit, but counts against it separately from the deferred pipeline. A step that mixes eligible and ineligible calls can therefore run one of each at once, so a limit of 1 bounds each path rather than the step as a whole. Set `eagerToolExecution: false` where a tool depends on being the only one running.

If the model errors and the request is retried or failed over, a tool that already finished has its call and result written into the conversation, so the replacement attempt sees the work as done rather than asking for it again. A tool still running when that happens is aborted.

A caller abort is the exception. It drops both the work still running and any result that finished but has not been written into the conversation yet, so a tool that completed in the moments before the abort can leave its side effect unrecorded.
