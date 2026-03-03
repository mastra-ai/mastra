---
'@mastra/core': patch
---

Tool lifecycle hooks (`onInputStart`, `onInputDelta`, `onInputAvailable`, `onOutput`) now fire correctly during agent execution for tools created via `createTool()`. Previously these hooks were silently ignored. Affected: `createTool`, `Tool`, `CoreToolBuilder.build`, `CoreTool`.
