---
'@mastra/core': patch
---

Fixed workspace sandbox tools (`execute_command`, `get_process_output`, `kill_process`) sending an empty tool result to the model when a `beforeToolCall` hook blocked the call with `{ error: reason }`. The model now receives the reason as an error result, so it no longer assumes a blocked command ran. Mastra Code's `PreToolUse` hooks block tools this way.
