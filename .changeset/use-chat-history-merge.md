---
'@mastra/react': patch
---

Fixed `useChat` with `withInitialHistory` losing live updates that arrive right after the history. A tool result that follows the history in the same response is now applied to the stored tool call, so the tool no longer stays stuck at `call`.
