---
'@mastra/factory': minor
---

Added a later answer for board moves on the workflow board engine. `POST /work-items/:id/transition` now answers `202` with an `inputId` once the move passes its first checks, and the move's answer follows on the project's feed stream as a `move` event with the same `inputId`. The board keeps the card moving until that event arrives and shows the reason when the move was refused. Moves that fail the first checks still answer `409` or `422`, and the default board engine still answers `200` with the result.

Board engines can opt in with the new optional `submitMove`:

```ts
const engine: FactoryBoardEngine = {
  ...inner,
  submitMove: async request => ({ inputId: crypto.randomUUID(), settled: inner.requestMove(request) }),
};
```
