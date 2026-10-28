---
'@mastra/factory': minor
---

Board phases can now say who runs them and when they start. `defineBoard()` accepts `name`, `description` and `nextPhases`, and working phases accept a `runner` (`{ agentId, skill, context, instructions }`), `autoStart` with an optional `autoStartWhen` rule, and an `exitTool` that moves the card on when its agent completes it (optionally approved without a person through `autoApprove` and `autoApproveWhen`).

```typescript
planning: {
  name: 'Planning',
  kind: 'working',
  runner: { context: 'build', skill: 'factory-plan' },
  autoStart: true,
  autoStartWhen: LOW_EFFORT,
  exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: LOW_EFFORT },
  nextPhases: ['execute', 'canceled'],
},
```

Existing boards keep working unchanged. `title`, `role`, `next` and `outcomes` are deprecated in favor of `name`, `runner.context` and `nextPhases`; defined boards and the board catalog expose both the old and new fields. `defineBoard()` logs a deprecation warning listing the old fields a board still uses.
