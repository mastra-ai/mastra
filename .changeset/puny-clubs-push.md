---
'@mastra/core': minor
---

Added dynamic function support for workspace tool config. The `enabled`, `requireApproval`, and `requireReadBeforeWrite` options now accept async functions in addition to static booleans, enabling context-aware tool behavior like disabling tools based on user tier or requiring approval only for certain file paths.

**Example**

```typescript
tools: {
  [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
    requireApproval: async ({ args }) => {
      return (args.path as string).startsWith('/protected')
    },
  },
  [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
    enabled: async ({ requestContext }) => {
      return requestContext['allowExecution'] === 'true'
    },
  },
}
```
