---
'@mastra/factory': minor
---

Write the skills your board phases run in code, next to the boards that use them. Every card session can load them, and a phase names one with `runner.skill`:

```ts
new MastraFactory({
  storage,
  skills: [
    {
      name: 'release-notes',
      description: 'Write release notes for the change',
      instructions: '# Release Notes\n\nList every user-facing change in one line each.',
    },
  ],
  boardConfig: {
    boards: [
      {
        key: 'docs',
        name: 'Docs',
        phases: [
          { key: 'open', name: 'Open', kind: 'resting' },
          { key: 'notes', name: 'Notes', kind: 'working', runner: { type: 'agent', agentId: 'mastra-code', skill: 'release-notes' } },
          { key: 'done', name: 'Done', kind: 'terminal' },
        ],
      },
    ],
  },
});
```

A skill in code replaces a bundled Factory skill or an app `factory-skills/` skill of the same name, and a repository skill cannot shadow it. An invalid skill throws when the Factory is built. The skills catalog in Settings now lists code skills and the app's `factory-skills/` folder alongside the bundled ones.
