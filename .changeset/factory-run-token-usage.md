---
'@mastra/factory': patch
---

Factory now records the token usage of each run on its `factory.run.ended` audit event, alongside the run's role and kickoff. The event carries the run's totals and its per-step usage, including steps from turns that were suspended and resumed. A run with no reported usage is marked `unreported`, so it no longer looks like zero spend. If the end event can't be saved, Factory logs a warning and keeps the usage for the retry instead of dropping it.

```ts
// event.metadata.usage on a factory.run.ended audit event
{
  status: 'recorded',
  stepCount: 2,
  totals: { promptTokens: 130, completionTokens: 60, totalTokens: 190 },
  steps: [
    { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
  ],
}

// when the run reported no usage
{ status: 'unreported' }
```
