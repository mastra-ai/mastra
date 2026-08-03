---
'@mastra/factory': patch
---

Review sessions now track the pull request they review. A session opened by the review board subscribes to its pull request when it is created, and the reconcile sweep now checks every pull request with an open subscription rather than only the ones still on the board. The thread and the workspace sidebar show the merged state once the pull request lands, instead of staying open forever because the review card had already moved to Done.
