---
'@mastra/factory': minor
---

Board phases can now say who runs them and when they start. `defineBoard()` accepts `name`, `description` and `nextPhases`, and working phases accept a `runner` (`{ agentId, skill, context, instructions }`), `autoStart` with an optional `autoStartWhen` rule, and an `exitTool` that ends the phase: once it succeeds, the agent moves the card to one of `nextPhases` with `factory_transition_work_item`. `autoApprove` and `autoApproveWhen` let a phase accept a `submit_plan` plan without a person.

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

Existing board declarations keep working: `defineBoard()` maps the deprecated `title`, `role` and `next` to `name`, `runner.context` and `nextPhases` and logs a warning listing them. The board it returns has only the new fields, so code reading `board.title`, `phase.title` or `phase.role` must read `name` and `runner.context` instead. The board catalog keeps sending `title` and `role` for older clients.
