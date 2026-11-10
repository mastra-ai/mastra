---
'mastra': patch
---

Fixed the Factory board's first column saying "No intake sources" on a board that an intake route files a connected source onto. It now shows "Intake is clear". A board that no enabled intake route places new cards on still offers to connect an issue source, because nothing will ever land there. If the intake routes fail to load, the column shows the error with a Retry button instead of either message.
