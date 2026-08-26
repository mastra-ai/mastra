---
'@mastra/factory': patch
---

Fixed the Factory sidebar reordering itself when you open a session. Opening a work or review session used to move its row to the top of its group, so the list shifted under your cursor as you clicked through it. Rows now keep their creation order, and a session that would sit past the first five rows is shown anyway, so you always see a row for the session you are in.
