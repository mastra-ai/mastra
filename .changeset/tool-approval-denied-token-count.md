---
'@mastra/memory': patch
---

Fixed observational memory token counting throwing on declined tool approvals. Token counting now accounts for `output-denied` tool invocations (added by the tool-approval recall fix) instead of erroring on the unhandled state.
