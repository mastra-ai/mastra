---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed retries after `modelSettings.timeout.totalMs` showing the model the same request twice. A run that hit the deadline saved only the user message, so retrying sent two identical user messages in a row with no reply between them.

A timed-out run now also saves an assistant message with a `MastraTimeoutError` error part next to the user message. This works the same way on every agent engine, including durable and Inngest agents. The notice is saved only when the user message is saved. Read-only memory still saves nothing. Normal agents with message history disabled save nothing, while durable, evented and Inngest agents already save the accepted input up front and now save the notice with it.

**Prompt change for existing conversations:** any assistant message with a stored `MastraTimeoutError` error part is now sent to the model as `[Reply interrupted: <message>]`, for example `[Reply interrupted: Agent execution timed out after 30000ms (modelSettings.timeout.totalMs)]`. This covers total, step (`stepMs`) and first-chunk (`firstChunkMs`) timeouts, and turns already in history. Before this change those messages were dropped from the prompt, so conversations with a past timeout will send a slightly different prompt after upgrading. Other error parts are still left out of the prompt.
