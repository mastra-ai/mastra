---
"@mastra/core": patch
---

Fixed repeated model requests after text-only responses with no provider finish reason. Preserved continuation for explicit provider signals such as Anthropic compaction and aligned the step continuation state with the loop's finish-reason handling.
