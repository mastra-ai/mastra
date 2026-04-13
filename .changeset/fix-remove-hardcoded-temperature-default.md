---
"@mastra/core": patch
---

Fixed agents incorrectly defaulting `temperature` to `0` when no temperature is explicitly set by the user. Previously, `agent.stream()` and `agent.generate()` always sent `temperature: 0` to the model provider, which broke models that only accept specific temperature values (e.g., Kimi K2.5 which requires `temperature: 1`). Now, when temperature is not explicitly set, the model provider's own default is used instead.
