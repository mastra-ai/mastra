---
'@mastra/factory': patch
---

Fixed the Factory sidebar reordering itself when you open a session. Opening a work or review session used to lift its row to the top of its group, so the list moved under your cursor as you clicked through it. Rows now keep their creation order, and a session that sorts below the collapsed fold is shown anyway, so a deep link or a hand-off from the board never lands you on a session with no row.
