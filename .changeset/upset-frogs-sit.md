---
'mastra': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Enabled Studio, Playground, deployers, and `useChat()` to use agent signal subscriptions by default while preserving `MASTRA_AGENT_SIGNALS=false` and explicit legacy Stream as opt-outs.
