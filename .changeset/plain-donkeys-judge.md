---
'@mastra/factory': patch
---

Re-review a pull request when contributors push to it. A push to a PR the Factory has already taken up moves its Review card back into Reviewing, which re-invokes the review skill through the stage rule that already exists; a card whose review is still running gets the push as a message instead, so an in-flight pass learns the head moved under it. Pushes to PRs parked in Intake, canceled cards, closed or merged PRs, and PRs owned by a Work item are all left alone.

Because most pushes to an open PR are the author merging the base branch to stay current, the review skill now triages before it re-reviews: it compares the effective diff it last reviewed against the diff at the new head by patch id, and when the change is untouched it lets its published verdict stand instead of spending a full pass restating it.
