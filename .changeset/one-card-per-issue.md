---
'@mastra/factory': minor
---

A pull request or merge request for an issue that is already on the Work board now joins that issue's card instead of opening a second card. The built-in Review board is removed; Work's PR review phase does its job.

**One card per issue.** A pull request Factory opens for one of its cards stays on that card. A pull request from a trusted author whose description says it closes an issue in the same repository (for example `Fixes #12`) is added to that issue's card, as long as nobody has started building that issue yet. Once a builder session is working on the card, someone else's pull request gets its own card. The card shows the pull request's status, the reviewer checks it out on its own branch, and merging it moves the card to Done. A pull request with no matching card still gets its own card, as before.

**Outside authors.** A pull request from an author without write access never joins another card, even when it says it fixes an issue. It gets its own card and waits in Intake.

**Review board removed.** Nothing in your database is migrated. For an existing install:

- Cards on the old Review board now show on Work, with Reviewing shown as PR review. Links to `/factories/:id/review` open Work filtered to cards with a pull request.
- An intake route that targets board `review` stops matching, and arrivals fall through to the next route. Board settings and skill overrides for `review` are ignored, and `review` can't be used as a custom board ID.
- `reviewBoard` is no longer exported. If you installed it yourself, remove it:

```ts
// Before
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard, reviewBoard] });

// After
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard] });
```

Pull requests filed before this change keep their own cards.
