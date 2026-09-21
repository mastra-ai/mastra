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

Eligibility is narrow by design: approval-gated, suspend-schema-declaring, provider-executed, client-side, background-dispatched (by argument or by config), auto-resumed, missing and inactive tools keep the previous behaviour, as does any run configured with `toolCallConcurrency.strategy: 'called'` or with an output processor that runs after the stream, which also covers a processor workflow you build yourself and `structuredOutput` given an explicit `model`. A caller abort cancels work already running, and durable agents reject an explicit `true`.

A tool that declares a suspend schema is excluded up front, but one that calls `suspend()` at runtime without declaring a schema cannot be detected in advance. That call is no longer restarted: the early attempt hands its suspension back to the call's own post-stream iteration, which raises the real suspension with the tool's own payload — so the body is not re-executed before suspending and the tool runs once per model attempt rather than twice, and the run resumes on the coordinate of the call that actually suspended. Resume still re-enters the body from the top with `resumeData` present, exactly as it does without eager dispatch. An intent carrying `requireToolApproval` still routes through the approval path.

Eager work honours the same configured concurrency limit, but counts against it separately from the deferred pipeline. A step that mixes eligible and ineligible calls can therefore run one of each at once, so a limit of 1 bounds each path rather than the step as a whole. Set `eagerToolExecution: false` where a tool depends on being the only one running.

If the model errors and a replacement attempt demonstrably starts — a retry or a fallback model — a tool that already finished has its call and result written into the conversation, so that attempt sees the work as done rather than asking for it again. A tool still running when that happens is aborted. Where no replacement attempt starts, finished work is left uncommitted.

A caller abort is the exception. It drops both the work still running and any result that finished but has not been written into the conversation yet, so a tool that completed in the moments before the abort can leave its side effect unrecorded.
