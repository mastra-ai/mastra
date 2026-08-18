---
'@mastra/factory': patch
---

Close the work/review loop: a review that requests changes now wakes the agent that authored the pull request.

`pull_request_review` webhooks were accepted and classified urgent, but no matching rule event existed, so the delivery was dropped after classification and the authoring agent was never told. PR subscriptions did not cover this — they sync PR activity into a thread's notification inbox for the agent to read on its *next* turn, but nothing starts that turn.

A new `pullRequestReviewSubmitted` rule event maps `pull_request_review`/`submitted`, and the default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Only `changes_requested` fires; `approved` and `commented` stay quiet, and the Review card that posted the review never reacts to its own output.
