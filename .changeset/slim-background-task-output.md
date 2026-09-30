---
'@mastra/core': patch
---

Fixed background workflow tools flooding pubsub with huge `task.output` events (#25590). When a background workflow tool's steps call an agent, the nested agent's `step-start`, `step-finish` and `finish` chunks were published with the full model request, message history and file parts. With Redis Streams, one event could reach 60MB and fill Redis.

These chunks are now published without the request and message snapshots (`request`, `inputMessages`, `messages`, `output.steps`, `metadata.request`, and `response` on `finish`). Progress UIs still get the fields they use, such as `messageId`, finish reason, usage and text. `task.output` events also no longer repeat the task's `args` on every chunk.
