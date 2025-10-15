---
---

**docs**: Add comprehensive documentation for model settings (temperature, topP, etc.)

Added detailed documentation on how to configure model settings like `temperature`, `topP`, `maxTokens`, `frequencyPenalty`, and `presencePenalty` when:
- Defining agents (via `defaultVNextStreamOptions`, `defaultGenerateOptions`, `defaultStreamOptions`)
- Making individual agent calls (via `modelSettings` parameter)
- Using the Mastra Client SDK (`agent.generate()` and `agent.stream()`)

This documentation was previously missing and made it difficult for users to understand how to control model behavior during agent creation and invocation, especially when upgrading from other frameworks.

