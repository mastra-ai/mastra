---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed invalid model timeout settings to throw the same TypeError across generation and resume APIs, including durable, evented, and Inngest agents, without consuming suspended runs. Cold recovery now checks caller settings and static defaults before executing. Inngest now requires `@mastra/core >=1.79.1-0` for the shared validation support.
