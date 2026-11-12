---
'@mastra/factory': patch
---

Fixed build-on-push for Factories connected to GitHub through Mastra Platform. A push to an environment repository's default branch now rebuilds the sandbox template, so new sessions start from current code instead of an old template.
