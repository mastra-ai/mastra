---
'@mastra/connect': patch
---

Fixed Slack channel connections that failed with "Slack refresh token is invalid" when connecting an agent. The Mastra platform now manages the Slack credential refresh cycle, so `channels()` no longer competes with it over the single-use refresh token.
