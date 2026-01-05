---
'@mastra/core': patch
---

Fix Anthropic API error when tool calls have empty input objects

Fixes issue #11376 where Anthropic models would fail with error "messages.17.content.2.tool_use.input: Field required" when a tool call in a previous step had an empty object `{}` as input.

The fix adds proper reconstruction of tool call arguments when converting messages to AIV5 model format. Tool-result parts now correctly include the `input` field from the matching tool call, which is required by Anthropic's API validation.

Changes:
- Added `findToolCallArgs()` helper method to search through messages and retrieve original tool call arguments
- Enhanced `aiV5UIMessagesToAIV5ModelMessages()` to populate the `input` field on tool-result parts
- Added comprehensive test coverage for empty object inputs, parameterized inputs, and multi-turn conversations
