---
'@mastra/slack': patch
---

Slack apps created by `SlackProvider` now request the `files:write` bot scope, so agents can post file attachments to a thread. Existing apps aren't updated automatically: add `files:write` under OAuth & Permissions → Bot Token Scopes and reinstall the app.
