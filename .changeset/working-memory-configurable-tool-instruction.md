---
"@mastra/core": patch
"@mastra/memory": patch
---

Added optional `toolInstruction` field to `WorkingMemoryConfig` to allow customizing the system prompt used by the `updateWorkingMemory` tool. When provided, replaces the default hardcoded instruction — giving developers control over when and how working memory updates occur without breaking existing behavior.
