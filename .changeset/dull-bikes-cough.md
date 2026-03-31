---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed type inference breaking when third-party packages augment Zod's `ZodType` (e.g. `@hono/zod-openapi`). Previously, importing such packages would silently widen `inputData`, workflow step compatibility checks, and other schema-derived types to `any`.

**`InferPublicSchema`**: Now uses cascading structural checks (`_output`, `_type`, `~standard`) instead of inferring from the full `PublicSchema` union, which was fragile to module augmentation.

**`createWorkflow`**: `inputSchema` and `outputSchema` types are now captured as schema-level generics (matching the pattern `createStep` already uses), preventing `workflow.then()` from silently accepting incompatible steps.

**`createTool`**: `requestContextSchema` is now captured as a schema-level generic. When provided, `requestContext` becomes required in the tool's execution context — callers of `tool.execute()` must provide it.

Fixes https://github.com/mastra-ai/mastra/issues/14896
