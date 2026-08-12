---
'@mastra/core': patch
---

Fixed output processors being skipped when the model provider throws an error. Output processors now run on failed streams with finishReason set to 'error', restoring the behavior from 1.55.0, so custom processors can observe and react to error terminals. Message history still avoids saving a user message when the provider fails before producing any output, so failed turns don't leave orphaned input in the conversation history. Cancelled (aborted) streams continue to skip output processors. Fixes #21292.
