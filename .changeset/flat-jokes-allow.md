---
'@mastra/code-sdk': patch
---

Fixed scheduled and notification runs pausing every tool call for approval when YOLO is off. These runs now follow the woken thread's own permission rules, so allowed tools run without pausing and independent tool calls run at the same time.
