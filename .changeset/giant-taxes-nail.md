---
'@mastra/agent-builder': patch
---

Defaulted the agent builder and template builder to current OpenAI models: `openai/gpt-6.1-sol` for primary work and `openai/gpt-6-luna` for lighter tasks. Newly scaffolded projects no longer start on `openai/gpt-4.1` or `openai/gpt-4o-mini`, which OpenAI retires on January 14, 2027.
