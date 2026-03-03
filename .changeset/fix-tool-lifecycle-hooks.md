---
'@mastra/core': patch
---

Fix tool lifecycle hooks (onInputStart, onInputDelta, onInputAvailable, onOutput) not firing during agent execution

Tool lifecycle hooks defined in `createTool()` were silently dropped at two points in the propagation chain:
1. The `Tool` constructor didn't assign hook properties from the options object
2. `CoreToolBuilder.build()` didn't transfer hooks to the returned `CoreTool`

Both breaks are now fixed, and hooks flow through the full `createTool → Tool → CoreToolBuilder → CoreTool` pipeline.
