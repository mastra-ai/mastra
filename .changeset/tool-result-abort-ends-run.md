---
'@mastra/core': patch
---

Fixed `processToolResult` aborts in output processors so they end the run at the first aborted tool result. Previously, aborting with parallel tool calls crashed the run with `Controller is already closed`, and aborting a single tool call made an extra model call after the stream had ended.
