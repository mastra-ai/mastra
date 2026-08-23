---
'@mastra/inngest': patch
---

Fixed Inngest durable agent runs writing two separate traces. Spans created before the run starts — input processors and memory recall — now nest under the single agent run span instead of being dropped or landing on a second trace, and the agent run span input shows the messages you passed in rather than internal message-list state. (#19841)
