---
'@mastra/factory': minor
---

New projects' Work board has no Triage phase: a project created now gets Intake → Planning → Building → Review → Done/Canceled. Existing projects keep the Work board they stored, Triage included, and a project created on an older release that stores its boards only now gets Work with Triage too. No migration adds or removes Triage. Add Triage in Settings › Work board if you want it; resetting a project's Work restores the shape it was stored with.

Factory now adds its Work board only to a project that has no boards yet. `factory.upsertBoard(board, { projects: 'all' })` also covers projects created later in the same process: a project with no boards gets the app's boards first, so it gets no Work from Factory beside an app's `work` board.

A project without a Work board still files every integration arrival (GitHub, GitLab, Linear, Jira, incident.io) and every card created without a board: its intake routes place them, and one no route takes lands in the initial phase of the project's first board. Before, such a project filed nothing.

`includeDefaultBoards` is deprecated and ignored, with a one-time warning. To run your own Work board, store it under the `work` key at startup instead of turning the default off:

```ts
// Before
const factory = new MastraFactory({ storage, includeDefaultBoards: false, boards: [ourWorkBoard] });

// After: the board as a stored definition (plain data), under the `work` key
import type { StoredBoardInput } from '@mastra/factory';

const ourWorkBoard: StoredBoardInput = {
  key: 'work',
  name: 'Work',
  phases: [
    { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['build', 'canceled'] },
    {
      key: 'build',
      name: 'Building',
      kind: 'working',
      runner: { skill: 'factory-build', context: 'work' },
      nextPhases: ['done', 'canceled'],
    },
    { key: 'done', name: 'Done', kind: 'terminal' },
    { key: 'canceled', name: 'Canceled', kind: 'terminal' },
  ],
};

const factory = new MastraFactory({ storage });
await factory.prepare();
await factory.upsertBoard(ourWorkBoard, { projects: 'all' });
```

`upsertBoard` takes the stored shape (`key` plus a `phases` array, first phase first), not a `defineBoard()` board; the README's "Stored boards" section lists every phase field.

Passing a board of your own with the `work` ID in `boards` now throws, since Work is always installed: apps that set `includeDefaultBoards: false` and passed their own `work` board must move it to `upsertBoard` as shown above.
