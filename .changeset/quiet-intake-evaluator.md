---
'@mastra/factory': minor
---

Removed the `intake.evaluator` option from `MastraFactory`. New projects already use the intake order, so the option only mattered for older projects.

- `MastraFactory` no longer accepts `intake: { evaluator }`.
- `GET /web/factory/projects/:id/intake-order` no longer reports `evaluatorSource: 'option'`; it reports `env`, `project`, or `legacy`.

**Upgrading**

Set the evaluator with the environment variable instead, the same on every replica:

```ts
// Before
new MastraFactory({ intake: { evaluator: 'route-list' } });

// After: FACTORY_INTAKE_EVALUATOR=route-list in the environment
new MastraFactory({});
```

Or switch one older project at a time: `mastra api factory intake-order set <project-id> '{"evaluator":"intake-order"}'`. Code that read `evaluatorSource: 'option'` should treat `env` as the forced case.
