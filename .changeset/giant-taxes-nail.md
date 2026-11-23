---
'@mastra/agent-builder': patch
---

Defaulted the agent builder and template builder to `openai/gpt-6-luna`, the replacement OpenAI recommends for the retiring `openai/gpt-4.1` and `openai/gpt-4o-mini`. Newly scaffolded projects no longer start on models OpenAI retires on January 14, 2027.
