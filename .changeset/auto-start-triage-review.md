---
'@mastra/factory': minor
---

Triage and Review on the default Work board now start on their own, even with the project's auto-run setting off. A working phase marked `autoStart: true` (Settings › Boards: "Starts on its own") runs without anyone approving the run, and a webhook move into it goes through without waiting. Cards from authors outside the repository's write access still wait for a person.

```ts
{ key: 'review', name: 'Review', kind: 'working', autoStart: true, runner: { type: 'agent', agentId: 'factory-review', skill: 'factory-review' } }
```
