---
'@mastra/factory': patch
---

Factory sessions can now start work you already asked for after a side session reports back, without asking you again.

When you ask for work that a side session should look into first, the session can start that side session with your approval attached. When the side session reports back, the session may file one work item and start one role on it on your behalf. The approval is single-use, expires after 24 hours, and covers only a card the session files after you approved. A replayed or unrelated notification can't use it.

When no approval covers the start, the refusal now says the card is filed but nothing was started, so the agent tells you the card is waiting instead of reporting the work as started.
