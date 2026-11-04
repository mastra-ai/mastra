---
'@mastra/core': minor
---

Scorer judges now accept the same `instructions` as agents, and dynamic instructions can read the run's `requestContext`. You can keep a large shared input, such as a report, in a cached system message and change it per run.

```ts
const reportAccuracy = createScorer({
  id: 'report-accuracy',
  description: 'Scores the accuracy of a report',
  judge: {
    model: 'anthropic/claude-haiku-5-5',
    instructions: ({ requestContext }) => [
      { role: 'system', content: 'Score the report from 0 to 1.' },
      {
        role: 'system',
        content: `Report: ${requestContext.get('report')}`,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
    ],
  },
}).generateScore({
  description: 'Score the accuracy of the report',
  createPrompt: () => 'How accurate is the report?',
});

await reportAccuracy.run({ input, output, requestContext: { report } });
```

Code that reads `judge.instructions` as a string needs a type check, because the field can now hold messages or a function.
