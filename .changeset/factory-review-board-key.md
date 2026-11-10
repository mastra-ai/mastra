---
'@mastra/factory': patch
---

Fixed boards under the key `review` being refused. The key is no longer reserved: a project can create, edit and delete a board under it through the boards API or `factory.upsertBoard()`, an app can pass one in `boards`, and a second create is refused with `409 board_exists` like any other key. Such a board is served in place of the retired Review board and keeps the cards stored on it. The `review` row an earlier release seeded stays hidden until someone edits it.

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
