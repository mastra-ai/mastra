---
'@mastra/evals': major
'@mastra/core': major
---

**BREAKING CHANGE**: Scorers for Agents will now use `MastraDBMessage` instead of `UIMessage`

- Scorer input/output types now use `MastraDBMessage[]` with nested `content` object structure
- Added `getTextContentFromMastraDBMessage()` helper function to extract text content from `MastraDBMessage` objects
- Added `createTestMessage()` helper function for creating `MastraDBMessage` objects in tests with optional tool invocations support
- Updated `extractToolCalls()` to access tool invocations from nested `content` structure
- Updated `getUserMessageFromRunInput()` and `getAssistantMessageFromRunOutput()` to use new message structure
- Removed `createUIMessage()`
