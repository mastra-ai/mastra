---
'@mastra/factory': patch
---

Improved sidebar performance in projects with many sessions. The Factory now builds the session list once and reuses it for everyone until a session, card or follow changes, so each sidebar request uses about half the server CPU it did.

Fixed the sidebar activity feed revealing the ids of other people's private sessions when one of those sessions was on a card that was running or waiting for someone.
