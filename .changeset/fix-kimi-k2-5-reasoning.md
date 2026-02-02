---
'@mastra/core': patch
---

Fix moonshotai/kimi-k2.5 multi-step tool calling failing with "reasoning_content is missing in assistant tool call message"

- Changed moonshotai and moonshotai-cn (China version) providers to use Anthropic-compatible API endpoints instead of OpenAI-compatible
  - moonshotai: `https://api.moonshot.ai/anthropic/v1`
  - moonshotai-cn: `https://api.moonshot.cn/anthropic/v1`
- This properly handles reasoning_content for kimi-k2.5 model
