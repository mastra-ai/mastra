---
'@mastra/factory': minor
---

A pull request or merge request for an issue that is already on the Work board now joins that issue's card instead of opening a second card. The built-in Review board is removed; Work's PR review phase does its job.

**One card per issue.** A pull request Factory opens for one of its cards stays on that card. Whether someone else's pull request joins an issue's card is now an intake route. Each project gets a new first route, "Pull requests that close a waiting issue join its card": a pull request from a trusted author whose description closes an issue in the same repository (for example `Fixes #12`) joins that issue's card while the card is still waiting in Intake and has no pull request yet, and the card moves to PR review. Once the issue has moved on (for example into Triage), the pull request gets its own card in PR review and is reviewed right away. Edit or delete the route to change this. The card shows the pull request's status, the reviewer checks it out on its own branch, and merging it moves the card to Done. A pull request with no matching card still gets its own card, as before.

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

**Review board retired.** The built-in Review board is retired and no longer installed; this supersedes the earlier note that it stays installed. Nothing in your database is migrated. For an existing install:

- Cards on the old Review board now show on Work, with Reviewing shown as PR review. Links to `/factories/:id/review` open Work filtered to cards with a pull request.
- An intake route that targets board `review` stops matching, and arrivals fall through to the next route. Board settings and skill overrides for `review` are ignored, and `review` can't be used as a custom board ID.
- `reviewBoard`, `ReviewBoardPhase`, `builtInBoard` and `pullRequestReviewPhase` are no longer exported from `@mastra/factory/boards`. Pull requests are always reviewed in Work's `pr-review` phase (`PULL_REQUEST_REVIEW_PHASE`). If you installed the Review board yourself, remove it:

```ts
// Before
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard, reviewBoard] });

// After
new MastraFactory({ storage, includeDefaultBoards: false, boards: [workBoard] });
```

Pull requests filed before this change keep their own cards.
