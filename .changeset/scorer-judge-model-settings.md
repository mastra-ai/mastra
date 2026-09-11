---
'@mastra/core': patch
---

Scorer judge configuration now accepts an optional `modelSettings` field (temperature, topP, topK, maxOutputTokens, maxRetries, frequencyPenalty, presencePenalty, timeout, etc.), forwarded to the internal judge agent run. It can be set at the scorer level and overridden per step, removing the need for an input-processor workaround. Closes #23458.

```ts
const scorer = createScorer({
  id: 'answer-relevancy',
  description: 'Scores answer relevancy',
  judge: {
    model: openai('gpt-4o'),
    instructions: 'Return a relevancy score.',
    // New: configure the judge model call directly
    modelSettings: { temperature: 0, maxRetries: 3 },
  },
})
  .analyze({
    description: 'analyze',
    outputSchema: z.object({ value: z.number() }),
    createPrompt: () => 'analyze this',
    // Optional per-step override (replaces the scorer-level value)
    judge: { modelSettings: { temperature: 0.7 } },
  })
  .generateScore(({ results }) => results.analyzeStepResult.value);
```
