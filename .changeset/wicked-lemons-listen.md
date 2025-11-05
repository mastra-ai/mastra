---
'@mastra/core': patch
---

Fix message conversion and Gemini API compatibility for tool-call messages

Two related fixes for handling messages with tool-calls:

1. **Stop filtering out input-available tool states in sanitizeV5UIMessages()**: Previously, `input-available` states (completed tool-calls) were being filtered out, causing assistant messages with only tool-calls to be dropped entirely. This broke loop tests with prepareStep. Now only `input-streaming` states are filtered, preserving completed tool-call messages.

2. **Filter problematic patterns before sending to Gemini**: When passing historical conversation messages with tool-calls to agent.network(), the AI SDK's convertToModelMessages creates empty tool messages and duplicate assistant messages. Added filterGeminiIncompatibleMessages() helper that removes these patterns before sending to Gemini, while preserving complete message history in response.messages for internal use and testing.
