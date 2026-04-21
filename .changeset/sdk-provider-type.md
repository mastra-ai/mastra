---
'@mastra/agent-browser': patch
'@mastra/stagehand': patch
---

Added `providerType = 'sdk'` property to SDK browser providers

This property distinguishes SDK-based browser providers from CLI-based providers, enabling proper browser context handling in agent configurations.
