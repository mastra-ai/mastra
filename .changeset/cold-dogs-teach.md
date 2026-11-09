---
'@mastra/factory': minor
---

Intake routes can now move existing cards on pull request events. A route's `on` list accepts `pull_request.opened`, `pull_request.synchronized` (a push), `pull_request.review_requested`, `pull_request.merged` and `pull_request.closed`, so a board decides where a card goes when its pull request is pushed, merged or closed.

```json
{
  "name": "Merged pull requests ship",
  "on": ["pull_request.merged"],
  "target": { "boardKey": "ship", "phaseKey": "shipped" }
}
```

New and existing projects get Work routes that keep today's behaviour: a merge moves the card to Done, a pull request closed unmerged moves its own card to Canceled and an issue card back to Intake, and a push or review request sends the card back to PR review. Deleted default routes aren't added back. When no enabled route takes the card, the built-in move still runs, so disabling or deleting a pull request route never strands a merged card in review.

A route's `when` can test `event.reason` only when its `on` includes `work_item.closed`, the only event that carries a reason.
