---
'@mastra/react': patch
---

Add an `enableThreadSignals` option to `useChat` for opting out of the agent-signals streaming path. The option defaults to `true`, preserving existing behavior for consumers unless they explicitly pass `false` to use the legacy `streamUntilIdle` route.
