---
'@mastra/factory': patch
---

Fixed Slack sessions ignoring the factory's configured default model and memory settings.

Sessions started from Slack ran on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed every Slack message with a missing-credentials error. Repo-backed Slack threads now start on the project's configured model and observational-memory settings, matching runs started from the web.

A thread keeps a model chosen inside it. Once a model is set on the thread, restarting the server no longer resets it to the project default.
