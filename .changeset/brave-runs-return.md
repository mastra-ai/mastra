---
'@mastra/inngest': patch
---

Fixed resumable `chatRoute` never reconnecting to a run of a `createInngestAgent` agent. After a page reload, `useChat({ resume: true })` got a `204` for the whole run because the agent couldn't report the run's owner and status. It now reads them from the run's saved workflow row, so the reconnect replays the run the same way it does for `createDurableAgent` and `createEventedAgent` agents. Fixes #31068.
