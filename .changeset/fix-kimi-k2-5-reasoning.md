---
'@mastra/core': patch
---

Fix moonshotai/kimi-k2.5 multi-step tool calling failing with "reasoning_content is missing in assistant tool call message"

- Upgraded `@ai-sdk/openai-compatible` from 1.0.27 to 1.0.32, which includes `reasoning_content` in assistant messages when reasoning parts are present
- Added integration test for kimi-k2.5 multi-step tool calling
