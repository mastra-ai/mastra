---
'@mastra/core': patch
---

Fixed missing `TRequestContext` type parameter on `DynamicArgument` fields in `AgentConfig`. Previously, only `instructions` and `tools` correctly propagated the `requestContextSchema` type to their dynamic function callbacks. Now all dynamic fields — `model`, `workflows`, `workspace`, `agents`, `memory`, `scorers`, `defaultGenerateOptionsLegacy`, `defaultStreamOptionsLegacy`, `defaultOptions`, `defaultNetworkOptions`, `inputProcessors`, and `outputProcessors` — properly type `requestContext` based on the agent's `requestContextSchema`.

**Before:**

```typescript
const agent = new Agent({
  requestContextSchema: z.object({ userId: z.string() }),
  workspace: ({ requestContext }) => {
    requestContext.get('userId'); // typed as `unknown`
  },
});
```

**After:**

```typescript
const agent = new Agent({
  requestContextSchema: z.object({ userId: z.string() }),
  workspace: ({ requestContext }) => {
    requestContext.get('userId'); // typed as `string`
  },
});
```
