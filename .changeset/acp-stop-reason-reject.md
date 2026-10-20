---
'@mastra/acp': patch
---

ACP prompts no longer hang when the agent stops with `max_tokens`, `cancelled`, `max_turn_requests` or `refusal`. `prompt()`, `AcpAgent.generate()`/`stream()` and ACP tools now reject with `ACP prompt stopped before completing: <reason>` instead of waiting forever and leaving an unhandled rejection.
