---
'@mastra/code-sdk': patch
---

Fixed scheduled and notification runs pausing every tool call for approval when YOLO is off. These runs now follow the woken thread's own permission rules, so allowed tools run without pausing. On regular agents, independent tool calls run concurrently. Durable and evented agents still run them one at a time unless YOLO is on.
