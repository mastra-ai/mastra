---
'mastra': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Enabled Studio via the CLI and deployers to use agent signal subscriptions by default while preserving `MASTRA_AGENT_SIGNALS=false`, `enableThreadSignals: false`, and explicit legacy Stream as opt-outs. The React `useChat()` hook remains opt-in for SDK consumers via `enableThreadSignals: true`.
