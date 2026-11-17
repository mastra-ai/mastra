---
'@mastra/factory': patch
---

Fixed reopened pull request review sessions loading the pull request's AGENTS.md and CLAUDE.md as trusted instructions. After a review card finished and the server restarted or unloaded the session, a new message in that session read instruction files from the pull request branch. Sessions that ever ran pull request or review work now keep reading instructions from the base branch, or read none when the trusted branch can't be determined.
