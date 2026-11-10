---
'@mastra/factory': patch
---

Fixed boards under the key `review` being refused. The key is no longer reserved: a project can create, edit and delete a board under it through the boards API or `factory.upsertBoard()`, an app can pass one in `boards`, and a second create is refused with `409 board_exists` like any other key. Such a board is served in place of the retired Review board and keeps the cards put on it. Cards the retired board left stored on `review` stay on Work: the write that creates the board stores their Work placement, and is refused with `409 board_in_use` while one of them is still open. The `review` row an earlier release seeded stays hidden until someone edits it, or the app defines a `review` board.

```ts
await factory.upsertBoard(
  {
    key: 'review',
    name: 'Review',
    phases: [
      { key: 'waiting', name: 'Waiting', kind: 'resting', nextPhases: ['reviewed'] },
      { key: 'reviewed', name: 'Reviewed', kind: 'terminal' },
    ],
  },
  { projects: 'all' },
);
```

With `projects: 'all'` the call stops at the first project where the retired Review board still has an open card. The projects before it keep the board, so finish or move those cards and run it again.
