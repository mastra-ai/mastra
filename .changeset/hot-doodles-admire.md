---
'@mastra/inngest': patch
---

Fixed Inngest durable agents so a throwing `stopWhen` keeps rejecting the agent stream now that a throwing workflow loop condition fails the run.
