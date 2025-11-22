---
'@mastra/ai-sdk': patch
---

Backports the `messageMetadata` and `onError` support from [PR #10313](https://github.com/mastra-ai/mastra/pull/10313) to the 0.x branch, adding these features to `toAISdkFormat` function.

- Added `messageMetadata` parameter to `toAISdkFormat` options
  - Function receives the current stream part and returns metadata to attach to start and finish chunks
  - Metadata is included in `start` and `finish` chunks when provided
- Added `onError` parameter to `toAISdkFormat` options
  - Allows custom error handling during stream conversion
  - Falls back to `safeParseErrorObject` utility when not provided
- Added `safeParseErrorObject` utility function for error parsing
- Updated `AgentStreamToAISDKTransformer` to accept and use `messageMetadata` and `onError`
- Updated JSDoc documentation with parameter descriptions and usage examples
- Added comprehensive test suite for `messageMetadata` functionality (6 test cases)
- Fixed existing test file to use `toAISdkFormat` instead of removed `toAISdkV5Stream`

- All existing tests pass (14 tests across 3 test files)
- New tests verify:
  - `messageMetadata` is called with correct part structure
  - Metadata is included in start and finish chunks
  - Proper handling when `messageMetadata` is not provided or returns null/undefined
  - Function is called for each relevant part in the stream

- Uses `UIMessageStreamOptions<UIMessage>['messageMetadata']` and `UIMessageStreamOptions<UIMessage>['onError']` types from AI SDK v5 for full type compatibility

- Backport of: https://github.com/mastra-ai/mastra/pull/10313
