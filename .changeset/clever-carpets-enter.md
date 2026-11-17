---
'@mastra/factory': minor
---

Organization admins can now create skills for one Factory from Settings › Skills, without redeploying. Choose **New skill**, give it a name, description and instructions, and the Factory's sessions can load it from their next start. A phase of the Factory's boards can also run it as `runner.skill`. Created skills show a **Custom** badge and can be edited or deleted from the same page. Creating and deleting are recorded in the audit log as `factory.skill.created` and `factory.skill.deleted`.

A board phase runs a created skill by its name, like any other skill:

```ts
await factory.upsertBoard(
  {
    key: 'notes',
    name: 'Release notes',
    phases: [
      { key: 'queued', name: 'Queued', kind: 'resting', nextPhases: ['writing'] },
      { key: 'writing', name: 'Writing', kind: 'working', runner: { context: 'writer', skill: 'release-notes' }, nextPhases: ['done'] },
      { key: 'done', name: 'Done', kind: 'terminal' },
    ],
  },
  // Each project listed must have created `release-notes`; a board for 'all' projects may only run the app's skills.
  { projects: [{ orgId, factoryProjectId }] },
);
```

If the app later ships a skill under the same name, the app's skill takes over the name and the Factory's text becomes an edit of it, which **Revert to original** removes.
