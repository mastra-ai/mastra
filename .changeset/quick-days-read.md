---
'@mastra/factory': patch
---

Dates and times in Factory now follow the browser's locale and clock. Session timelines used to force 24-hour times, and activity chart hours had no minutes in 24-hour browsers (`9 – 15` is now `09:00 – 15:00`).
