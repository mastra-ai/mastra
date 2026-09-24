---
'@mastra/core': patch
---

Start a tool as soon as its own arguments are complete, instead of waiting for the model's streaming step to finish. Previously a tool whose arguments had fully arrived still waited on later sibling calls and trailing content, which cost seconds of dead time on every step that called a tool. `agent.stream()` now dispatches an eligible server-side tool call the moment it is complete, while the model keeps streaming, and the existing pipeline still owns result ordering and message history.

```ts
// A tool call completes early in the step; its execution no longer waits for
// the rest of the model's output.
const eager = await agent.stream('Compare the weather in Paris and Rome');

// Opt out to restore the previous scheduling.
const deferred = await agent.stream('Compare the weather in Paris and Rome', {
  eagerToolExecution: false,
});
```

Eligibility is narrow by design: approval-gated, suspend-schema-declaring, provider-executed, client-side, background-dispatched (by argument or by config), auto-resumed, missing and inactive tools keep the previous behaviour, as does any run configured with `toolCallConcurrency.strategy: 'called'`, with an output processor implementing `processToolResult` while a provider-executed tool is configured (a provider result reaching that hook can abort from inside the stream, before the post-stream pass would have started the call at all), or with an output processor that runs after the stream, which also covers a processor workflow you build yourself and `structuredOutput` given an explicit `model`. A caller abort cancels work already running, and durable agents reject an explicit `true`.

A tool that declares a suspend schema is excluded up front, but one that calls `suspend()` at runtime without declaring a schema cannot be detected in advance. That call is no longer restarted: the early attempt hands its suspension back to the call's own post-stream iteration, which raises the real suspension with the tool's own payload — so the body is not re-executed before suspending and the tool runs once per model attempt rather than twice, and the run resumes on the coordinate of the call that actually suspended. Resume still re-enters the body from the top with `resumeData` present, exactly as it does without eager dispatch. An intent carrying `requireToolApproval` still routes through the approval path.

Eager work honours the same configured concurrency limit, but counts against it separately from the deferred pipeline. A step that mixes eligible and ineligible calls can therefore run one of each at once, so a limit of 1 bounds each path rather than the step as a whole. Set `eagerToolExecution: false` where a tool depends on being the only one running.

Two rules hold on every path that ends a model attempt early: a tool that already ran is never run a second time, and its finished result is never thrown away.

- If the last model fails mid-stream with no retry or fallback, the calls it emitted still run through the normal pipeline, and a tool already running eagerly is adopted rather than started again.
- If the attempt is retried or failed over, a tool that already finished has its call and result written into the conversation immediately, so the replacement attempt sees the work as done. This also holds when the retry never runs. A tool still running at that point is aborted.
- A caller abort cancels work still running and writes any finished result into the conversation before the run tears down.

A call that suspended has no result to carry, so a discarded attempt drops its pending suspension intent. If the replacement attempt asks for that call again, the tool runs from the top and repeats any effect it performed before `suspend()`. Set `eagerToolExecution: false` where that cannot safely happen.
