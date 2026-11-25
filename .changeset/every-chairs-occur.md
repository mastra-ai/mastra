---
'@mastra/client-js': patch
'@mastra/react': patch
---

Fixed `useChat` showing a cut-off reply as complete when the model failed partway through. `sendMessage()` now rejects with the error, `isRunning` goes back to `false`, and the partial text stays in `messages`, so you can show the failure to the user. `declineToolCall()` now does the same when its stream fails, instead of staying stuck in the running state.
