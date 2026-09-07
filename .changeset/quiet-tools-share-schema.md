---
'@mastra/core': patch
---

Fixed shared tools exposing `_background` to agents that do not support background execution.

Agents now advertise `_background` only for eligible tools. `suspendedToolRunId` and `resumeData` remain scoped to resumable tools. Repeated schema conversions no longer add nested validators.
