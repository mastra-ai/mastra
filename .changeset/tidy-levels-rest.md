---
'@mastra/code-sdk': patch
---

Added the thinking level to each assistant message's metadata (`content.metadata.thinkingLevel`). It records the level the model actually ran at: `max` on a model that tops out at `xhigh` is saved as `xhigh`, and `off` on an OpenAI GPT-5 model is saved as `low`.
