---
'mastra': patch
---

Show subscribed pull requests in the Factory session status line. Subscriptions are stored keyed on the factory project id, but the chat UI queried them with the session resourceId, so the PR chip never rendered for factory-bound sessions.
