---
'@mastra/core': minor
---

Add an opt-in `'called'` tool-call concurrency strategy so batches of purely safe tool calls run in parallel even when an approval/suspending tool stays registered on the agent.

`toolCallConcurrency` now accepts an object form in addition to a number:

```ts
// number (unchanged): concurrency limit, 'available' strategy
toolCallConcurrency: 8

// object form: pick the limit and/or strategy
toolCallConcurrency: { limit: 8, strategy: 'called' }
```

- `strategy: 'available'` (default, unchanged): any approval/suspending tool *available* in the step forces the whole batch sequential, even if the model did not call it. Conservative — a suspend can never race a sibling.
- `strategy: 'called'`: only the tools the model *actually called* this step are checked. An available-but-uncalled approval/suspend tool no longer serializes a batch of safe calls; a batch that *does* call one still runs sequentially (concurrency 1), and a run-wide `requireToolApproval` policy still forces sequential. Useful for agents (e.g. multi-step generation pipelines) that keep an approval tool registered across a run but never mix it into the same batch as parallelizable calls.

Applies to both the standard loop and the durable (`@mastra/inngest` / `@mastra/temporal`) engine.
