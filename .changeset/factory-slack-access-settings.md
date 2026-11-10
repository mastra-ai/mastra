---
'@mastra/factory': minor
---

Added a "What sessions can do in Slack" section to Settings › Connections › Slack. For each Factory you can choose which channels its Slack sessions can use (only their own, their own plus the ones you pick, or every channel the app is in), whether they can post in other channels or only read them, and who they can DM (no one, only people connected to the Factory, or anyone). Anything a Factory hasn't set uses the deployment's `tools` settings on `SlackIntegration`.

When you pick a public channel the app isn't in yet, the app joins it for you. Private channels still need someone in them to run `/invite` with the app. Existing Slack apps need to be reinstalled to get the new `channels:join` permission.
