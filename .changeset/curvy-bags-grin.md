---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed invalid model timeout settings to throw the same TypeError across generation and resume APIs, including durable, evented, and Inngest agents, without consuming suspended runs.
