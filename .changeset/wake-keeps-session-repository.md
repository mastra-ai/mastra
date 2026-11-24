---
'@mastra/factory': patch
---

Fixed source-control tools failing with "The active source-control session does not match its controller repository" after a pull request event woke a session. When a session followed a pull request in another repository of its environment, waking it filed the session under the pull request's repository, so every later source-control call in that session (pushing, reading reviews or comments) was refused until the process restarted. A woken session now keeps the repository it was started with.
