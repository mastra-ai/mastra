---
'mastracode': patch
---

Fixed notifications for assistant questions, plan approvals, sandbox access requests, and tool approvals so the bell, system notification, and Notification hooks fire the moment Mastra Code starts waiting for input — even while an earlier prompt is still pending. Fixes #20398.
