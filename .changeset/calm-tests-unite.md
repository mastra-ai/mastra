---
'@mastra/core': patch
'@mastra/memory': patch
---

Consolidate memory integration tests and fix working memory filtering in MessageHistory processor

Moved `extractWorkingMemoryTags`, `removeWorkingMemoryTags`, and `extractWorkingMemoryContent` utilities from `@mastra/memory` to `@mastra/core/memory` so they can be used by the `MessageHistory` processor.

Updated `MessageHistory.filterMessagesForPersistence()` to properly filter out `updateWorkingMemory` tool invocations and strip working memory tags from text content, fixing an issue where working memory tool call arguments were polluting saved message history for v5+ models.

Also consolidated integration tests for agent-memory, working-memory, and pg-storage into shared test functions that can run against multiple model versions (v4, v5, v6).

