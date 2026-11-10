---
'@mastra/inngest': patch
---

Fixed Inngest durable agents running two agent runs on the same memory thread at once after the process that started a run exits. The Inngest worker now holds the thread lease while it executes the run's model and tool steps, and a new `stream()`/`generate()` on that thread waits until the still-executing run finishes instead of running its tools beside it.
