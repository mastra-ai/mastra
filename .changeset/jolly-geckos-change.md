---
'@mastra/factory': minor
---

Intake rules can now set a description on the cards they create, so cards from integrations show the item's details instead of an empty description.

```ts
return {
  type: 'upsertLinkedWorkItem',
  board: context.intake.board,
  source: 'github-dependabot-alert',
  sourceKey: alert.id,
  title: alert.title,
  description: alert.description,
  url: alert.url,
  stage: context.intake.initialPhase,
  // ...
};
```
