---
'@internal/external-types': patch
---

Fixed TypeScript accepting function values as individual tool entries in `AgentConfig.tools`. TypeScript now correctly rejects `tools: { myTool: () => realTool }` — each entry must be a tool object, not a resolver function. The entire tools map can still be a dynamic resolver function via the `DynamicArgument` pattern.
