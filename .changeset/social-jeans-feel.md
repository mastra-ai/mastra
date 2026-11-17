---
'@mastra/factory': minor
'mastra': patch
---

Added moving a Factory card to another board by hand. Naming another installed board in the work-item transition endpoint now moves the card there, keeping its id, history, and sessions; the board UI offers it under a card's "Move to board" menu. A busy card stays put until its run ends, and a finished card stays on its own board.
