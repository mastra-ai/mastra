---
'@mastra/client-js': patch
'@mastra/core': patch
---

Preserve client-tool call args across streaming recursion. `@mastra/client-js` `processStreamResponse` now sends a separate `role: 'tool'` message with the original args attached as `input` (mirroring `generateLegacy` and the existing `ToolResultWithInput` convention). `@mastra/core` `AIV5Adapter.fromModelMessage` consults that `input` field instead of fabricating `args: {}` when the matching tool-call lives in a prior model message. Fixes #16017.
