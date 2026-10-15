---
'@mastra/factory': patch
---

Improved the Slack "Could not authorize the owner of Slack Factory session" error. It now states which check failed:

- The sender's account link has no organization.
- No source-control session row exists for the session, or its project repository row is missing.
- The source-control session row has no organization.
