---
'@mastra/factory': minor
---

New issues now land in Work › Triage, and a phase's start rule decides which cards run there without anyone approving the run, even with the project's auto-run setting off. On the default Work board Triage and Review start every card, and Planning starts only cards labelled `effort: low`; other plans wait for a person. Mark a working phase `autoStart: true` (Settings › Boards: "Starts on its own") and optionally narrow it with an `autoStartWhen` rule.

```ts
{
  key: 'planning',
  name: 'Planning',
  kind: 'working',
  autoStart: true,
  autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort: low' }] },
  runner: { type: 'agent', agentId: 'code-agent', skill: 'factory-plan' },
}
```

Projects that stored their boards before this keep their routes and phases until edited in Settings › Boards.
