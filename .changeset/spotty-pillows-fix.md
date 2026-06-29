---
'@mastra/core': patch
---

Fixed Google provider-executed tool results (e.g. `file_search`) being dropped when the tool ran alongside another tool. Some providers assign the tool result a different `toolCallId` than the original tool call, so the result never merged into the stored call and the next request to the model failed with a "Corrupted tool call context" error. The tool call now matches by tool name as a fallback when the id differs, so the result is recorded correctly.
