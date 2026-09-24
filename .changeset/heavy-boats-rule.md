---
'@mastra/factory': patch
---

Fixed Factory runs woken by a notification or cross-agent signal on an idle thread failing with "No usable anthropic credential is configured". The run now resolves credentials as the user who owns the Factory session, in that session's organization, including sessions opened from the browser or Slack.
