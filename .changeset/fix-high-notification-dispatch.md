---
'@mastra/core': patch
---

Plan due notification dispatches per thread from a single due snapshot so high-priority notifications that already emitted summaries are delivered in full before lower-priority notifications or summaries can wake the same thread. `Agent.sendNotificationSignal` also accepts an array of notification inputs so related notifications can be evaluated against the same initial thread state before any delivery wakes the thread.
