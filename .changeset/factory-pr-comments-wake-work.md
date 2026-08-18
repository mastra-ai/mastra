---
'@mastra/factory': patch
---

Route pull request comments to the agent that authored the pull request, and stop provenance from branding commenters as Factory.

Comments on a PR arrive as `issue_comment` with `issue.pull_request` set, and the ingress explicitly dropped them. That closed the most common feedback path of all: on a Factory-authored PR, GitHub refuses a formal `--approve`/`--request-changes` verdict from the account that opened it, so the review skill falls back to `gh pr comment` — which was discarded. External review bots leaving plain comments were dropped for the same reason.

A new `pullRequestCommentCreated` rule event now carries those comments, reading the pull request from the `issue` payload so provenance binds the comment to the authoring Work item rather than mistaking the number for an issue's. The default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Factory's own comments are ignored, because `factoryAuthored` cannot distinguish the Work role from the Review role and reacting to them would let an agent wake itself in a loop.

Separately, `factoryAuthored` was derived from PR provenance for every event, which proves the *pull request* came from Factory, not the sender of the event. Any human or review bot commenting on a Factory-authored PR was therefore marked as Factory. Provenance-based attribution is now skipped for events whose sender is responding to the PR — comments, submitted reviews, and re-requested reviews — where only the app login identifies Factory.
