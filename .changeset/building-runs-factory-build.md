---
'@mastra/factory': minor
---

Building on the default Work board is now an agent phase like the others: it activates the new bundled `factory-build` skill, which implements the plan approved in Planning, proves it with tests, pushes, and hands the work on. The round's task and hand-off arrive as the skill's arguments, so changing Building's skill in Settings › Boards changes how cards are built while Factory still decides when.

```ts
{ key: 'execute', name: 'Building', kind: 'working', runner: { type: 'agent', agentId: 'factory-build', skill: 'factory-build', context: null } }
```
