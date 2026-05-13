---
'mastra': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Make the playground/Studio chat runtime opt into the agent-signals streaming path (`sendSignal` + `subscribeToThread`) via the `MASTRA_AGENT_SIGNALS` environment variable. When unset (the default), Studio falls back to the existing `streamUntilIdle` route — this restores the pre-signals behavior while issues with tool approvals and dropped signal/UI messages are fixed.
