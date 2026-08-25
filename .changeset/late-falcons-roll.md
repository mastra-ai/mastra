---
'@mastra/core': patch
---

Fixed the `onDelegationComplete` hook so its `result` now includes `finishReason` (on both `generate()` and `stream()` paths) and its type declares `subAgentToolResults`. Hooks can now tell whether a sub-agent actually finished (`finishReason: 'stop'`) or was cut off mid tool-call, and can read sub-agent tool results without casting. Fixes #21942.
