---
'@mastra/cli': patch
---

Updated hardcoded model router defaults to the latest models in each family:

- `create` provider adapters: Anthropic `claude-sonnet-5` → `claude-sonnet-5-5` and `claude-haiku-4-5` → `claude-haiku-5-5`, Google `gemini-3.5-flash` → `gemini-3.8-flash`, xAI `grok-4.3` → `grok-4.7`
- `init` sample scaffolds: OpenAI `gpt-5-mini` → `gpt-5.4-mini`, Anthropic `claude-sonnet-5` → `claude-sonnet-5-5`, Mistral `mistral-medium-2508` → `mistral-medium-2604`
- `create-mastra` harness template: primary model `openai/gpt-5.6-terra` → `openai/gpt-6.1-sol`, observational memory model `openai/gpt-5-mini` → `openai/gpt-5.4-mini`
