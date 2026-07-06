---
'@mastra/core': patch
---

Fixed `agent.generate()` and `agent.stream()` rejecting AI SDK v7 messages under strict TypeScript. AI SDK v7 `ModelMessage` and `UIMessage` inputs are now accepted, matching the existing v4-v6 support. (#18956)
