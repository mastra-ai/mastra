---
'@mastra/evals': patch
---

Fixed prebuilt LLM-judge scorers (faithfulness, answer relevancy, bias, hallucination, toxicity, …) crashing with `TypeError: output.find is not a function` when used against workflows, inline tasks, or string targets. The shared input/output helpers and scorer run types now also accept `string`, `ModelMessage[]`, `{ prompt }` (workflow input), `{ text }` / `{ content }` (workflow / task output), and a single assistant message object — alongside the existing agent shape.

```ts
// Previously crashed; now works.
await createFaithfulnessScorer({ model, options: { context: ['Paris is the capital of France.'] } }).run({
  input: { prompt: 'What is the capital of France?' },
  output: { text: 'Paris is the capital of France.' },
});
```

Fixes [#15615](https://github.com/mastra-ai/mastra/issues/15615).
