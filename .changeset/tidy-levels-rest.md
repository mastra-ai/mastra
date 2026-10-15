---
'@mastra/code-sdk': patch
---

Added the thinking level to each assistant message's metadata (`content.metadata.thinkingLevel`). It records the level the model actually ran at: `max` on a model that tops out at `xhigh` is saved as `xhigh`, and `off` on an OpenAI GPT-5 model is saved as `low`.

Removed `getEffectiveThinkingLevel` from `@mastra/code-sdk/providers/openai-codex`. Use `appliedThinkingLevel` from `@mastra/code-sdk/thinking-catalog` with the full model id instead, for example `appliedThinkingLevel('openai/gpt-5.3-codex', 'max')`.
