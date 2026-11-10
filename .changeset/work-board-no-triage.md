---
'@mastra/factory': minor
---

New projects' Work board has no Triage phase: a project created now gets Intake → Planning → Building → Review → Done/Canceled. Existing projects keep the Work board they stored, Triage included, and a project created on an older release that stores its boards only now gets Work with Triage too. No migration adds or removes Triage. Add Triage in Settings › Work board if you want it; resetting Factory's Work restores Factory's built-in Work, with Triage if Factory first stored the project's Work with it (an app's Work resets to the app's, see below).

Factory now adds its Work board only to a project that has no boards yet. `factory.upsertBoard(board, { projects: 'all' })` also covers projects created later in the same process: a project with no boards gets the app's boards first, so it gets no Work from Factory beside an app's `work` board.

A project without a Work board still files every integration arrival (GitHub, GitLab, Linear, Jira, incident.io) and every card created without a board: its intake routes place them, and one no route takes lands in the initial phase of the project's first board. Before, such a project filed nothing.

`includeDefaultBoards` is deprecated and ignored, with a one-time warning. To run your own Work board, store it under the `work` key at startup instead of turning the default off.

For now, a board stored under `work` must keep Work's code phases and moves, because Factory's code (intake, source-closed handling, integrations) moves cards between them: Intake stays first, and Intake, Planning, Building (`execute`), Review (`pr-review`), Done and Canceled keep their kind and every move Work makes between them. Names, runners, exit tools, start conditions, added phases and added moves are free. Boards under any other key are free. `upsertBoard` refuses a `work` board that drops one of these with `code_behaviour`.

```ts
// Before
const factory = new MastraFactory({ storage, includeDefaultBoards: false, boards: [ourWorkBoard] });

// After: Work's stored definition, edited where Work's code allows, under the `work` key
import { boardDefinitionOf, MastraFactory, workBoard } from '@mastra/factory';
import type { StoredBoardInput } from '@mastra/factory';

const work = boardDefinitionOf(workBoard);
const ourWorkBoard: StoredBoardInput = {
  ...work,
  phases: [
    ...work.phases.map(phase => {
      // Free: names, runners and start conditions.
      if (phase.key === 'planning') {
        return { ...phase, name: 'Plan', autoStart: true, runner: { ...phase.runner, instructions: 'Follow docs/planning.md.' } };
      }
      // Free: added moves.
      if (phase.key === 'execute') return { ...phase, nextPhases: [...(phase.nextPhases ?? []), 'blocked'] };
      return phase;
    }),
    // Free: added phases.
    { key: 'blocked', name: 'Blocked', kind: 'resting', nextPhases: ['planning', 'execute', 'canceled'] },
  ],
};

const factory = new MastraFactory({ storage });
await factory.prepare();
await factory.upsertBoard(ourWorkBoard, { projects: 'all' });
```

`upsertBoard` takes the stored shape (`key` plus a `phases` array, first phase first), not a `defineBoard()` board; `boardDefinitionOf(workBoard)` gives Work's, and the README's "Stored boards" section lists every phase field.

`upsertBoard(board, { projects: 'all' })` replaces the `work` row of every existing project with your definition, at that row's current revision: edits people made to Work in Settings are discarded each time it runs. Check what projects have stored before you start running it.

Resetting a board your app upserted with `projects: 'all'` (Settings, or `POST …/boards/:key/reset`) restores your app's definition from this process's last `upsertBoard` call, not Factory's Work. Factory's one-time Work migrations never run on it either. A project's own Work, with no app board under `work`, resets to Factory's built-in Work, with Triage or without depending on how Factory first stored it.

Passing a board of your own with the `work` ID in `boards` now throws, since Work is always installed: apps that set `includeDefaultBoards: false` and passed their own `work` board must move it to `upsertBoard` as shown above.
