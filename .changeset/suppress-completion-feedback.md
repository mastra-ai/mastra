---
'@mastra/core': minor
---

Add `suppressFeedback` configuration option to completion validation

- Added `suppressFeedback?: boolean` option to `CompletionConfig` interface
- When enabled, prevents completion feedback messages from being saved to memory
- Keeps conversation history cleaner by avoiding internal system messages in subsequent iterations
- Maintains backward compatibility (defaults to `false`)
- Includes comprehensive test coverage for both enabled and default behavior
