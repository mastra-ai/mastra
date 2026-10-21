---
'@mastra/factory': minor
---

Added messaging between Factory sessions. A user session's agent can message another session in its Factory with `factory_signal_session` (priority `low`, `medium`, `high` or `urgent`, default `medium`), and the receiving session answers that message with `factory_message_origin`. Messages arrive as `factory-session` notifications on the receiver's own thread, and a woken session runs as its own owner.
