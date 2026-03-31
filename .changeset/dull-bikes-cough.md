---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed type inference breaking when third-party packages augment Zod's `ZodType` (e.g. `@hono/zod-openapi`). Previously, importing such packages would silently widen `inputData`, workflow step compatibility, and other schema-derived types to `any`.

**`InferPublicSchema`**: No longer widens to `any` when third-party Zod augmentations are present.

**`createWorkflow`**: `inputSchema` and `outputSchema` types are now captured as generics (matching the pattern `createStep` already uses). `workflow.then()` now correctly rejects incompatible steps:

```ts
import {} from "@hono/zod-openapi";

const step = createStep({
  id: "needs-extra",
  inputSchema: z.object({ prompt: z.string(), extra: z.number() }),
  // ...
});

const workflow = createWorkflow({
  id: "wf",
  inputSchema: z.object({ prompt: z.string() }),
  // ...
});

// Before: silently accepted. After: type error
workflow.then(step);
```

**`createTool`**: When `requestContextSchema` is provided, `requestContext` is now required in the execution context:

```ts
const tool = createTool({
  id: "my-tool",
  description: "Tool with required context",
  requestContextSchema: z.object({ patientId: z.string() }),
  execute: async () => ({ ok: true }),
});

// Before: no error. After: type error — missing requestContext
tool.execute?.({}, {});
```

Fixes https://github.com/mastra-ai/mastra/issues/14896
