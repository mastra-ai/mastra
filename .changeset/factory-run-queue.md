---
'@mastra/factory': minor
---

**Lower default run cap**

A Factory server now runs at most 10 automated agent runs at once, down from 25. Runs past the cap wait their turn instead of all starting together. Raise the cap with `dispatcher.maxInFlight`, or the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` environment variable on a deployed server. The cap applies to each server process, not to the whole deployment.

```ts
new MastraFactory({
  dispatcher: { maxInFlight: 25 },
});
```

**See the run queue on the board**

The board now shows how many automated runs are waiting for a free slot. Click the indicator to see each waiting run in order, with its card, and open the card from the list. A waiting card says `Queued (#3)` instead of `Starting an automated run…`. The same data is available from `GET /web/factory/projects/:id/run-queue`.
