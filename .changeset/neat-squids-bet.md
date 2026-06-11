---
'mastracode': patch
'@mastra/agent-builder': patch
---

Bumped @ai-sdk/anthropic to pick up refusal stop condition (vercel/ai#15928). When Anthropic refuses a request due to usage policy, the SDK now surfaces a proper stop reason instead of silently halting the agent loop.
