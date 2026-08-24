---
'@mastra/factory': patch
---

Fixed session timing measurements that started too early or missed workspace tool activity.

**First interaction time**
Starts on the first user or assistant message. Signal-only messages (skill loads, phase markers, memory reminders) and sessions that fail before a message no longer affect this metric.

**First meaningful tool time**
Starts when the first workspace tool completes successfully. File operations and workspace searches count even when no shell command runs. Approval-denied and abort-while-parked tool completions are excluded because the tool never actually ran.
