---
'@mastra/code-sdk': patch
---

Fixed notifications for the thread you have open being treated as belonging to another project when the thread's recorded project path differs from the current checkout. Such notifications now run in your session instead of failing with "No model available". If a Mastra Code process for the thread's own project is also running, only one of the two delivers each notification.
