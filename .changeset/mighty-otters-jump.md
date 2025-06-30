---
"@mastra/core": patch
---

Fix MessageList toUIMessage to filter out tool invocations with state="call" or "partial-call"

Previously, when converting messages to UIMessage format, tool invocations with state="call" or "partial-call" were included in the output. This caused issues when using clientTools with the useChat hook, as these incomplete tool invocations would be displayed to users and could cause duplicate entries.

This fix ensures that:
- Only tool invocations with state="result" are included in UIMessage output
- The filtering is consistent with the existing sanitizeUIMessages method
- All tool invocation data is still preserved in the database for multi-process scenarios
- Client-side tools work correctly without displaying incomplete invocations