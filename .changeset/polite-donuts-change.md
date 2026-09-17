---
'@mastra/github-signals': minor
---

Added authorization for GitHub App bot comments when the app is owned by the repository organization or by a user with authorized repository access. Explicitly ignored bots and bots whose app ownership cannot be resolved remain denied.
