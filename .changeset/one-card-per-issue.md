---
'@mastra/factory': minor
---

A pull request or merge request for an issue that is already on the Work board now joins that issue's card instead of opening a second card. New projects no longer get the built-in Review board; Work's PR review phase does its job.

**One card per issue.** A pull request Factory opens for a GitHub issue card stays on that card. On GitLab, a merge request Factory opens stays on any card with an issue of its own (GitLab, Linear, Jira or incident.io). Every other card, including a manual card, gets a separate card for its pull request, as before. Whether someone else's pull request joins an issue's card is now an intake route. Each project gets a new first route, "Pull requests that close a waiting issue join its card": a pull request from a trusted author whose description closes an issue in the same repository (for example `Fixes #12`) joins that issue's card while the card is still waiting in Intake and has no pull request yet, and the card moves to PR review. Once the issue has moved on (for example into Triage), the pull request gets its own card in PR review and is reviewed right away. Edit or delete the route to change this. The card shows the pull request's status, the reviewer checks it out on its own branch, and merging it moves the card to Done. A pull request with no matching card still gets its own card, as before.

Intake routes gain a target option and three conditions for this:

```json
{
  "name": "Fixes for planned issues join their card",
  "when": {
    "operator": "AND",
    "conditions": [
      { "field": "author.trusted", "operator": "equals", "value": true },
      { "field": "pullRequest.closesIssue", "operator": "equals", "value": true },
      { "field": "closedIssue.phase", "operator": "equals", "value": "planning" }
    ]
  },
  "target": { "boardKey": "work", "phaseKey": "planning", "joinClosedIssue": true }
}
```

`closedIssue.hasPullRequest` is also available. When the route doesn't match, or the issue has no usable card, the pull request goes to the next route.

**Outside authors.** A pull request from an author without write access never joins another card, even when it says it fixes an issue and a route would let it. It gets its own card and waits in Intake.

**Review board retired.** New projects don't get the Review board; this supersedes the earlier note that it stays installed. Nothing in your database is migrated. An existing project keeps it while it's still in use, decided per project when its boards are read:

- A project with at least one card on the Review board that isn't Done or Canceled keeps the board as before: its cards stay there in their phases and are reviewed there, and `/factories/:id/review` opens it. No new card can be created on it.
- A project whose Review cards are all Done or Canceled (or that has none) loses the board. Its old cards show on Work, with Reviewing shown as PR review, and `/factories/:id/review` opens Work filtered to cards with a pull request. Once a project's last open Review card finishes, the board goes away for good.
- New pull requests follow the project's intake routes; the default one files them on Work › PR review. In a project that lost the Review board, an intake route that targets `review` stops matching and arrivals fall through to the next route. Board settings and skill overrides for `review` are ignored, and `review` can't be used as a custom board ID.
- `reviewBoard`, `ReviewBoardPhase` and `builtInBoard` are no longer exported from `@mastra/factory/boards`, and `pullRequestReviewPhase(board)` returns `pr-review` for every board but `review`. If you installed the Review board yourself, remove it; Factory serves it to the projects that still need it:

```ts
// Before
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard, reviewBoard] });

// After
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard] });
```

Pull requests filed before this change keep their own cards.

The review-status comment on a GitHub pull request also appears when the pull request is reviewed on the issue card it belongs to. A builder checking its own work posts no status comment.

A pull or merge request on a card is matched by its repository as well as its number, so another linked repository's #17 (or another GitLab project's !17) never moves a card that carries its own. A GitLab merge request is filed on a card by its branch only when the card belongs to the same GitLab project.
