---
'mastra': patch
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

- Enabled the Playground and Studio agent-signals chat path by default while preserving `MASTRA_AGENT_SIGNALS=false` as an opt-out.
- Added a legacy Stream chat method fallback for debugging the no-signals path.
- Improved thread subscription cleanup so mode switches detach the listener while explicit cancel still aborts the active run.
- Added subscription-native tool approval routes so approval and decline actions resume through the active thread subscription.
