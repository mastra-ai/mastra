---
'@mastra/factory': patch
---

Board cards now read the same session status as the sidebar rows. A card used to show one static dot for any bound session, whatever the session was doing; it now resolves running, initializing and attention through the same precedence the sidebar uses, so a cloning workspace shows initializing, a run in flight shows working on any bound role session, and a finished run nobody opened holds the same "your turn" mark as its row.
