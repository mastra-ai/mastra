---
'@mastra/factory': minor
---

A board phase's `runner.agentId` now names one of the agents backing Factory's controller — today only `code-agent` — instead of a code runner. Settings › Boards picks it from a list, and saving any other agent fails with a 422 (a `boardConfig` naming one throws at startup). The phase's skill now decides which built-in behaviour runs: `factory-triage`, `factory-plan`, `factory-build`, `factory-review` and `factory-complete-issue` bring Factory's own code and tools, any other skill just runs in the card's session.

```ts
{ key: 'triage', name: 'Triage', kind: 'working', runner: { type: 'agent', agentId: 'code-agent', skill: 'factory-triage', context: 'triage' } }
```

To change what a built-in phase's agent is told, add a skill of the same name to the app's `factory-skills/` folder.
