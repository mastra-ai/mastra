---
'@mastra/code-sdk': patch
---

Added the thinking level to each assistant message's metadata (`content.metadata.thinkingLevel`), including on hosts that resolve credentials per request, such as Factory. Each model in a fallback route records its own level, fitted to the levels that model accepts: `max` on a model that tops out at `xhigh` is saved as `xhigh`, and `off` on an OpenAI GPT-5 model is saved as `low`.

Removed `getEffectiveThinkingLevel` from `@mastra/code-sdk/providers/openai-codex`. Use `appliedThinkingLevel` from `@mastra/code-sdk/thinking-catalog` with the full model id instead, for example `appliedThinkingLevel('openai/gpt-5.3-codex', 'max')`.
