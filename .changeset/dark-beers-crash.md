---
'@mastra/ai-sdk': patch
---

Adds support for `messageMetadata` and `onError` options to `toAISdkV5Stream` function, enabling custom metadata attachment to stream chunks and custom error handling.

- Added `messageMetadata` parameter to `toAISdkV5Stream` options
  - Function receives the current stream part and returns metadata to attach to start and finish chunks
  - Metadata is included in `start` and `finish` chunks when provided
- Added `onError` parameter to `toAISdkV5Stream` options
  - Allows custom error handling during stream conversion
- Updated JSDoc documentation with parameter descriptions and usage examples
- Added comprehensive test suite for `messageMetadata` functionality (6 test cases)

- All existing tests pass (18 tests across 3 test files)
- New tests verify:
  - `messageMetadata` is called with correct part structure
  - Metadata is included in start and finish chunks
  - Proper handling when `messageMetadata` is not provided or returns null/undefined
  - Function is called for each relevant part in the stream

- Uses `UIMessageStreamOptions<UIMessage>['messageMetadata']` and `UIMessageStreamOptions<UIMessage>['onError']` types from AI SDK v5 for full type compatibility
