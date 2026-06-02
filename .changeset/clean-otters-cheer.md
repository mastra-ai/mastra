---
'@mastra/client-js': patch
---

Fix threaded client-tool continuations to rely on memory instead of resending persisted assistant messages. When a `threadId` is present, `streamUntilIdle` continuations now send only the tool-result messages, preventing duplicate reasoning/message item IDs during streaming. Stateless continuations still prepend persisted assistant (non-user) messages to preserve context.
