---
'@mastra/core': patch
---

Fixed message part ordering in agent streaming responses. Message parts (text, reasoning, tool calls) now appear in the correct order they arrived in the stream, preventing incorrect step sequencing and agent loop behavior issues.
