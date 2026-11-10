---
'@mastra/factory': minor
---

New projects' Work board has no Triage phase: a project created now gets Intake → Planning → Building → Review → Done/Canceled. Existing projects keep the Work board they stored, Triage included, and a project created on an older release that stores its boards only now gets Work with Triage too. No migration adds or removes Triage. Add Triage in Settings › Work board if you want it; resetting a project's Work restores the shape it was stored with.

Factory now adds its Work board only to a project that has no boards yet. `factory.upsertBoard(board, { projects: 'all' })` also covers projects created later in the same process: a project with no boards gets the app's boards first, so it gets no Work from Factory beside an app's `work` board.

`includeDefaultBoards` is deprecated and ignored, with a one-time warning. To run your own Work board, store it under the `work` key at startup instead of turning the default off:

```ts
// Before
const factory = new MastraFactory({ storage, includeDefaultBoards: false, boards: [ourWorkBoard] });

// After
const factory = new MastraFactory({ storage });
await factory.prepare();
await factory.upsertBoard(ourWorkBoardDefinition, { projects: 'all' });
```

Passing a board of your own with the `work` ID in `boards` now throws, since Work is always installed.
