---
'@mastra/core': minor
---

Harness subagents now accept processor chains.

`HarnessSubagent` now accepts `inputProcessors` and `outputProcessors`, and the built-in `subagent` tool passes them to the fresh subagent `Agent` used for non-forked runs.
Forked subagents continue to reuse the parent Agent and ignore definition-level processors.

```ts
const subagents: HarnessSubagent[] = [
  {
    id: 'explore',
    name: 'Explorer',
    description: 'Explore a focused task.',
    instructions: 'You are an explorer.',
    inputProcessors: [myInputProcessor],
    outputProcessors: [myOutputProcessor],
  },
];
```
