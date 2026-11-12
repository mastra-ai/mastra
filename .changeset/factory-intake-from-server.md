---
'@mastra/factory': patch
---

Fixed Factory slowing down while boards are open. Each open board used to ask GitHub, GitLab, Linear, Jira and incident.io for their open issues and pull requests every 30 seconds. The server now keeps that list itself, as part of the checks it already runs, and a board reads it from the server.

`GET /web/factory/projects/:id/intake/candidates` returns a project's open issues and pull requests that have no card yet, newest first. It calls no provider. `source` is repeatable and takes an integration such as `linear`, or one with a kind such as `github:pull-request`; `label` keeps the records that carry a label. `passes` says when each source was last read in full and whether its last read failed. The `feed-events` stream sends an `intake` event when the list changes.

**What changes for a running Factory**

- A new issue from GitLab, Linear, Jira or incident.io reaches the board within five minutes instead of 30 seconds. GitHub and GitLab events still arrive at once.
- The list routes of the five providers no longer create cards. Cards are created by the server's own checks, so disabling a provider's reconcile flag also stops its new issues from reaching the board.
- Deleting the card of an issue that is still open puts the issue back in Intake.
- A GitHub repository picked or dropped as an issue source in Settings › Intake changes the Intake column within five minutes, at the server's next check for missed pull requests. Saving the selection asks GitHub for nothing.

Work-item storage gains `storeIntakeCandidate`, `removeIntakeCandidate`, `getIntakeCandidate`, `listIntakeCandidates` and `onIntakeChanged`.
