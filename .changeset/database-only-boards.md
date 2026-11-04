---
'@mastra/factory': minor
---

Each project's boards now live only in its database. Factory writes a copy of the built-in Work board and of every board passed to `MastraFactory({ boards })` when a project is created; existing projects get theirs the first time Factory loads them (including at startup). Factory then serves that stored copy, edited or not, so what you see in the database is the board that runs.

**Default changes:** an unedited Work board moves to a newer Factory default only when a release ships one, and never back, so replicas on two versions during a deploy don't undo each other. Edited copies keep your changes. App boards are copied once: when your code for one changes, the project keeps its copy and the board shows `defaultChanged: true` until you reset it or write the new definition.

**Boards that no longer fit the code** (edited copies a release no longer fits, older boards stored under a code board's key, copies of boards the app stopped defining) are now served instead of hidden, with the code behaviour that still fits and a `problems` entry for anything dropped.

**Writing a board into a project:** added `factory.upsertBoard()`, which writes a board definition into an existing project, for example to push a changed app board into a copy that no longer follows its code. It creates or replaces the board with the same checks, cache refresh and audit as the boards API, one project per call; a board under a new key gets no code behaviour. An unchanged board writes nothing; a refused write throws `BoardWriteError` with the API's error code.

```ts
await factory.upsertBoard(
  { orgId, factoryProjectId },
  {
    key: 'bugs',
    name: 'Bugs',
    phases: [
      { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
      { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
      { key: 'fixed', name: 'Fixed', kind: 'terminal' },
    ],
  },
);
```

**Deprecated:** `defineBoard()` and the `boards` option of `MastraFactory`. They keep working; manage boards through the boards API instead. Removal is tracked in mastra-ai/mastra#28920.
