---
'@mastra/playground-ui': patch
---

Improved the span panel in Studio traces: input, output and errors are now shown as human-readable views instead of raw JSON. Agent and model spans display their messages as a conversation (with tool calls and results), agent results render as markdown, suspended/aborted runs and tripwires show as banners, and span errors appear as a dedicated error banner. A Rich | Raw toggle keeps the exact stored JSON one click away; spans without a richer form (tool calls, workflow steps, ...) keep the JSON view.
