---
'@mastra/acp': patch
---

Fixed ACP prompts hanging when the agent stops with `max_tokens`, `cancelled`, `max_turn_requests` or `refusal`. `prompt()`, `AcpAgent.generate()` and ACP tools now reject with `ACP prompt stopped before completing: <reason>`. `AcpAgent.stream()` still returns a result, but its `text` promise rejects and reading `fullStream` errors with the same message. Reading only `fullStream` no longer leaves an unhandled rejection.
