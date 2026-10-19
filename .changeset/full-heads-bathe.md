---
'@mastra/code-sdk': patch
---

Fixed notifications for the thread you have open being treated as belonging to another project when the thread's recorded project path differs from the current checkout. Such notifications now run in your session instead of failing with "No model available".
