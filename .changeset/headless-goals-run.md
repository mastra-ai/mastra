---
'@mastra/code-sdk': minor
---

Add goal execution to the headless `runMC` API. Goal runs use the same GoalManager and system-reminder signal path as the TUI and resolve on terminal `goal_evaluation` events without manual continuation messages.

```ts
const run = runMC({
  controller,
  session,
  goal: {
    objective: 'Implement and verify the requested change',
    judgeModelId: 'openai/gpt-5-mini',
    maxRuns: 20,
  },
});

for await (const event of run) {
  console.log(event.type);
}

const result = await run.result;
```
