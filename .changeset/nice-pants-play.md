---
'@mastra/inngest': patch
---

Using `createStep` with a nested Inngest workflow now returns the workflow itself, maintaining the correct `.invoke()` execution flow Inngest workflows need to operate.
