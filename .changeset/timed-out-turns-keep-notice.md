---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed retries after `modelSettings.timeout.totalMs` showing the model the same request twice. A run that hit the deadline saved only the user message, so retrying sent two identical user messages in a row with no reply between them.

A timed-out run now also saves an assistant message with a `MastraTimeoutError` error part next to the user message. On the next turn the model sees that notice as a short assistant text, for example `[Reply interrupted: Agent execution timed out after 30000ms (modelSettings.timeout.totalMs)]`. This works the same way on every agent engine, including durable and Inngest agents. The notice is saved only when the user message is saved, so read-only memory and disabled message history still save nothing.
