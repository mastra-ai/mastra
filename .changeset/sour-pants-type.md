---
'@mastra/factory': patch
---

Improved sidebar performance in projects with many sessions. The Factory now builds the session list once and reuses it for everyone until a session, card or follow changes, so each sidebar request uses about half the server CPU it did.

Fixed the sidebar activity feed telling other people when your private session on a card was running or waiting for someone.
