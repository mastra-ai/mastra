---
'@mastra/react': patch
'mastra': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Make the playground/Studio chat runtime opt into the agent-signals streaming path (`sendSignal` + `subscribeToThread`) via the `MASTRA_AGENT_SIGNALS` environment variable. When unset (the default), Studio falls back to the existing `streamUntilIdle` route — this restores the pre-signals behavior while issues with tool approvals and dropped signal/UI messages are fixed.

`useChat` from `@mastra/react` now accepts an `enableThreadSignals` prop (defaults to `true`, preserving behavior for other consumers); `packages/playground` passes `false` unless `MASTRA_AGENT_SIGNALS=true` is set on the process serving Studio.
