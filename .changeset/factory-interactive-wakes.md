---
'@mastra/factory': minor
---

**A person's reply no longer waits behind automated runs.** When a trusted collaborator comments on, or reviews, a card's GitHub pull request or issue, the session wakes even while automated runs hold every run slot. Each server process keeps 2 slots for these replies on top of `dispatcher.maxInFlight`, claims them first, and lets them borrow a free automated slot. Bot accounts, untrusted authors, Factory's own comments and activity from other sources still wait as automated runs.

Change the reserve with `dispatcher.maxInteractiveInFlight` (or `MASTRACODE_DISPATCH_MAX_INTERACTIVE_IN_FLIGHT`); `0` keeps no reserve:

```ts
const factory = new MastraFactory({
  storage,
  dispatcher: { maxInFlight: 10, maxInteractiveInFlight: 2 },
});
```

With the defaults a process holds up to 12 run slots. `GET /web/factory/projects/:id/run-queue` adds a `lane` to each run, `queuedByLane`, and `slots.interactive`; existing fields keep their meaning. The board's queue lists waiting replies first.

GitHub rule actors now carry `human: true` when GitHub reports the sender as a user.
