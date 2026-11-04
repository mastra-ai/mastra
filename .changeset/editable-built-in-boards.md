---
'@mastra/factory': minor
---

Each project's boards now live in its database, and admins can edit them. Factory stores the built-in Work board, every board passed to `MastraFactory({ boards })` and every definition passed as `seedBoards` in a project once: when the project is created, and in existing projects the first time Factory loads them (including at startup). Factory then serves the stored board, so what you see in the database is the board that runs. Work and app boards keep their code behaviour, so edits can't break the work their code runs.

```bash
# Edit the project's Work board (the whole board, with its revision)
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" -H 'content-type: application/json' -d @work.json

# Back to Factory's current definition, at the next revision
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work/reset" -H 'content-type: application/json' -d '{"expectedRevision": 3}'
```

**What you can change:** names and descriptions, extra next phases, when a phase starts on its own, when its exit tool is approved on its own, runner instructions, and new phases.

**What stays fixed on Work and app boards:** phases the code declares, their kind, the first phase, the runner context and skill of phases whose work runs in code, declared exit tools, and the moves Factory's code makes between phases. Edits that change these are refused with `422 code_behaviour`, listing each conflict.

**Releases don't update existing projects' boards.** A newer Work default or a changed app board doesn't reach a project that already stored the board. Resetting a board rewrites it to Factory's current definition at the next revision, so revisions never go back and an editor holding an older one is refused. A board a project deleted is not stored again. App and `seedBoards` boards can be deleted; the Work board can't, boards can't be created over a code board's key (`409 code_board`), and the legacy Review board stays read-only. Boards a release no longer fits are served with the code behaviour that still fits and a `problems` entry for anything dropped.

**Boards from code:** `seedBoards` stores definitions in every project once, including projects created later, and `factory.insertBoard()` is a one-off write that stores a board in the projects you name (or all) that don't have it, never overwriting one they have, which also brings back a board a project deleted:

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
