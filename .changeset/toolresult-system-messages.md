---
'@mastra/core': patch
---

Fixed `processToolResult` processors that return `{ messages, systemMessages }`: the step output now carries the same system-only list the MessageList holds, instead of the processor's raw array including non-system entries.
