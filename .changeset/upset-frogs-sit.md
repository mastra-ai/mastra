---
'mastra': patch
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Enabled the Playground and Studio agent-signals chat path by default while preserving MASTRA_AGENT_SIGNALS=false as an opt-out. Added a legacy Stream chat method fallback for debugging the no-signals path. Separated thread subscription unsubscribe from active-run aborts so mode switches only detach the listener while explicit cancel still aborts the run. Added subscription-native tool approval routes so approving or declining a tool call resumes the run through the active thread subscription instead of requiring the legacy continuation stream.
