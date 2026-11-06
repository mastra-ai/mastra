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

**What changes for existing scorers**

- The run's `requestContext` now reaches judge instructions, tools, and processors on every path that passes one to `scorer.run`: direct runs, `runEvals`, live scorers, network completion scorers, `isTaskComplete`, and goals. Live scorers receive only text, number, and boolean values, with nested objects as dotted keys. Network completion scorers receive only values that can be serialized.
- `isTaskComplete` and goal judges also receive `toolCalls`, `toolResults`, `agentId`, and `agentName` in that context. These values replace your own keys with the same names.
- When values from the run reach the judge, a judge tool's `requestContext.set()` calls apply to a copy for that call. Later judge calls and the `judge.requestContext` object don't see them.
- `scorer.run` doesn't pass reserved Mastra keys or `MastraMemory` from the run to the judge. To give the judge a reserved key, set it on `judge.requestContext`. The default goal judge already does this: it copies every key except the thread and resource IDs.
- Step-level `judge` no longer accepts `requestContext`, because it had no effect. Set it on the scorer-level `judge`.

**Type change**

Code that reads `judge.instructions` as a string now needs a type check, because the field can hold messages or a function.

```ts
// Before
const text: string = judge.instructions;

// After
const text = typeof judge.instructions === 'string' ? judge.instructions : undefined;
```
