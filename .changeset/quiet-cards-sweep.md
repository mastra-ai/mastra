---
'@mastra/factory': minor
---

Cards on a workflow board no longer stay `running` forever when the process that watched their run dies. A `running` card's board run has a 6-hour deadline and a `probing` one 30 minutes (`deadlineAt` in `describe`), and every Factory process sweeps the board runs once a minute: a card past its deadline whose run ended moves by the outcome its agent reported, or is flagged `needs_attention`; a run still going that the dispatcher no longer tracks is stopped and the card flagged `needs_attention` as overdue.

```ts
new MastraFactory({
  // ...
  boardEngine: createWorkflowBoardEngine({ deadlines: { runningMs: 2 * 60 * 60_000, probingMs: 15 * 60_000 } }),
});
```

Engines may implement the new optional `sweep(now, engine)` member. The default engine is unchanged.
