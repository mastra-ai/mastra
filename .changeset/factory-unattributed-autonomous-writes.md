---
'@mastra/factory': patch
---

Fixed Factory labeling its GitHub comments, reviews, and pull requests with the wrong person's name.

- Runs nobody started, such as the review agent's verdict and test report on a new pull request, are no longer marked "Opened by" whoever connected the repository, and pull requests they open are no longer assigned to that person.
- Messages sent from Slack to a shared session now name the person who sent them instead of the session's owner.

Turns a signed-in person starts, and runs a person released from the board, still carry that person's name.
