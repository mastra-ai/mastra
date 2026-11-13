---
'@mastra/factory': patch
---

Factory sessions can now start work you already asked for after a side session reports back, without asking you again.

When you ask for work that a side session should look into first, the session can start that side session with your approval attached. In the turn the side session's final report wakes, the session may file one work item and start one role on it on your behalf. The approval is single-use, expires after 24 hours, and covers only a card filed after the side session's final report, started within 30 minutes of it, with no other notification (a webhook, another session's message, a rule notice) reaching the session in between. Progress updates don't count as the report.

When no approval covers the start, the refusal now says the card is filed but nothing was started, so the agent tells you the card is waiting instead of reporting the work as started.
