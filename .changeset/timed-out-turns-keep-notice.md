---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed retries after `modelSettings.timeout.totalMs` showing the model the same request twice. A run that hit the deadline saved only the user message, so retrying sent two identical user messages in a row with no reply between them.

A timed-out run now also saves an assistant message with a `MastraTimeoutError` error part next to the user message, so history, `recall` and Studio show the turn as answered. This works the same way on every agent engine, including durable and Inngest agents. The notice is saved only when the user message is saved. Read-only memory still saves nothing. Normal agents with message history disabled save nothing, while durable, evented and Inngest agents already save the accepted input up front and now save the notice with it.

**What the next request sees:** at the deadline the run also saves a persisted `system-reminder` signal (`type: 'reactive'`) on the thread. The next request carries it as a user message between the timed-out request and the new one, for example `<system-reminder type="timeout-notice">The previous reply was interrupted: Agent execution timed out after 30000ms (modelSettings.timeout.totalMs)</system-reminder>`. The signal is only stored; it is never delivered into the timed-out run and does not start a new one. Like other signals it is hidden from `recall` unless you pass `hideSignals: []`. Stored error parts, including the new one, are still never sent to the model, and existing history is unchanged.
