---
'@mastra/factory': minor
---

Each project's boards now live only in its database. Factory stores the built-in Work board, every board passed to `MastraFactory({ boards })` and every definition passed as `seedBoards` in a project once: when the project is created, and in existing projects the first time Factory loads them (including at startup). Factory then serves the stored board, edited or not, so what you see in the database is the board that runs.

**Behaviour change: releases no longer update existing projects' boards.** A newer Work default or a changed app board doesn't reach a project that already stored the board; reset the board (`POST …/boards/:boardKey/reset`) to take Factory's current definition, at the next revision. A board a project deleted is not stored again. Every editable board has a stored revision.

**Boards that no longer fit the code** (edited boards a release no longer fits, older boards stored under a code board's key, boards the app stopped defining) are now served instead of hidden, with the code behaviour that still fits and a `problems` entry for anything dropped. App boards and `seedBoards` boards can be deleted; the Work board can't.

**New board definitions in code:** `seedBoards` stores definitions in every project once, including projects created later, and `factory.insertBoard()` is a one-off write that stores a board in the projects you name (or all) that don't have it, never overwriting one they have, which also brings back a board a project deleted:

```ts
const bugs = {
  key: 'bugs',
  name: 'Bugs',
  phases: [
    { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing'] },
    { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
    { key: 'fixed', name: 'Fixed', kind: 'terminal' },
  ],
} satisfies StoredBoardInput;

// Every project stores Bugs once, now and when it's created.
const factory = new MastraFactory({ storage, seedBoards: [bugs] });
await factory.prepare();

// Once: give Bugs back to a project that deleted it.
const { inserted, skipped } = await factory.insertBoard(bugs, { projects: [{ orgId, factoryProjectId }] });
```

**Deprecated:** `defineBoard()` and the `boards` option of `MastraFactory`. They keep working; use `seedBoards`, `factory.insertBoard()` or the boards API instead. Removal is tracked in mastra-ai/mastra#28920.
