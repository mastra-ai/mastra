---
'@mastra/factory': minor
---

New projects' Work board has no Triage phase: a project created now gets Intake → Planning → Building → Review → Done/Canceled. Existing projects keep the Work board they stored, Triage included, and a project created on an older release that stores its boards only now gets Work with Triage too. No migration adds or removes Triage. Add Triage in Settings › Work board if you want it; resetting a project's Work restores Factory's built-in Work, with Triage if Factory first stored the project's Work with it (see below for app boards).

Factory now adds its Work board only to a project that has no boards yet. `factory.upsertBoard(board, { projects: 'all' })` also covers projects created later in the same process: a project with no boards gets the app's boards first, so it gets no Work from Factory beside an app's `work` board.

A project without a Work board still files every integration arrival (GitHub, GitLab, Linear, Jira, incident.io) and every card created without a board: its intake routes place them, and one no route takes lands in the initial phase of the project's first board. Before, such a project filed nothing.

`includeDefaultBoards` is deprecated and ignored, with a one-time warning. To run your own Work board, store it under the `work` key at startup instead of turning the default off.

A board stored under `work` must keep Work's code phases and moves, because Factory's code (intake, source-closed handling, integrations) moves cards between them: Intake stays first, and Intake, Planning, Building (`execute`), Review (`pr-review`), Done and Canceled keep their kind and every move Work makes between them. Names, runners, exit tools, start conditions, added phases and added moves are free. Boards under any other key are free. `upsertBoard` refuses a `work` board that drops one of these with `code_behaviour`.

```ts
// Before
const factory = new MastraFactory({ storage, includeDefaultBoards: false, boards: [ourWorkBoard] });

// After: the board as a stored definition (plain data), under the `work` key
import type { StoredBoardInput } from '@mastra/factory';

const ourWorkBoard: StoredBoardInput = {
  key: 'work',
  name: 'Work',
  phases: [
    { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['planning', 'pr-review', 'done', 'canceled'] },
    {
      key: 'planning',
      name: 'Plan',
      kind: 'working',
      runner: { skill: 'factory-plan', context: 'work', instructions: 'Follow docs/planning.md.' },
      autoStart: true,
      exitTool: { id: 'submit_plan', autoApprove: false },
      nextPhases: ['execute', 'intake', 'done', 'canceled'],
    },
    {
      key: 'execute',
      name: 'Building',
      kind: 'working',
      runner: { skill: 'factory-build', context: 'work' },
      nextPhases: ['pr-review', 'planning', 'blocked', 'done', 'canceled'],
    },
    // Added: a phase of your own, and the moves into and out of it.
    { key: 'blocked', name: 'Blocked', kind: 'resting', nextPhases: ['planning', 'execute', 'canceled'] },
    {
      key: 'pr-review',
      name: 'Review',
      kind: 'working',
      runner: { skill: 'factory-review', context: 'review' },
      tools: ['factory_record_review_verdict', 'factory_review_source'],
      nextPhases: ['intake', 'planning', 'execute', 'done', 'canceled'],
    },
    { key: 'done', name: 'Done', kind: 'terminal', nextPhases: ['pr-review'] },
    { key: 'canceled', name: 'Canceled', kind: 'terminal', nextPhases: ['intake', 'pr-review'] },
  ],
};

const factory = new MastraFactory({ storage });
await factory.prepare();
await factory.upsertBoard(ourWorkBoard, { projects: 'all' });
```

`upsertBoard` takes the stored shape (`key` plus a `phases` array, first phase first), not a `defineBoard()` board; the README's "Stored boards" section lists every phase field.

`upsertBoard(board, { projects: 'all' })` replaces the `work` row of every existing project with your definition, at that row's current revision: edits people made to Work in Settings are discarded each time it runs. Check what projects have stored before you start running it.

Resetting a project's Work board (Settings, or `POST …/boards/work/reset`) restores Factory's built-in Work, with Triage or without depending on how Factory first stored it, not the board your app upserted. Run `upsertBoard` again (or restart) to put yours back.

Passing a board of your own with the `work` ID in `boards` now throws, since Work is always installed: apps that set `includeDefaultBoards: false` and passed their own `work` board must move it to `upsertBoard` as shown above.
