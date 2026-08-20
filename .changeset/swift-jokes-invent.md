---
'@mastra/factory': patch
---

Fixed factory board runs and Slack channel sessions inheriting the GitHub connection owner's personal observational-memory model settings. Factory sessions now always use the project's default model and the built-in observational-memory defaults, so runs no longer fail when the connection owner has a model configured that the workspace has no API key for. Web chat sessions still use each user's own memory settings.
