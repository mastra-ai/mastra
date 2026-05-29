---
'mastra': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Enabled the Playground and Studio agent-signals chat path by default while preserving MASTRA_AGENT_SIGNALS=false as an opt-out. Added a legacy Stream chat method fallback for debugging the no-signals path.
