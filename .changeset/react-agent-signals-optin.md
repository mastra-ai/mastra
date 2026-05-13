---
'@mastra/react': patch
---

Add an `enableThreadSignals` option to `useChat` for explicitly opting into the agent-signals streaming path. The option defaults to `false`, keeping consumers on the legacy `streamUntilIdle` route unless they pass `true`.
