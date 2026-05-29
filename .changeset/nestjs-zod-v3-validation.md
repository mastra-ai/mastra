---
'@mastra/nestjs': patch
---

Fixed validation error responses on routes with `bodySchema`, `queryParamSchema`, or `pathParamSchema` losing field path information when consumers pin a different `zod` major than the one bundled with this adapter. Responses now return the actual field name in `issues[].field` (e.g. `"agent_id"`) instead of `"unknown"` with the raw Zod issues serialized into `issues[0].message`.

`ValidationError.zodError` is now typed as `ZodErrorLike` (a structural subset of `ZodError` exposing `issues[]`) so consumers pinning a different `zod` major still type-check. The runtime value is unchanged; cast to your installed `ZodError` type if you need its instance methods.

Fixes [#17167](https://github.com/mastra-ai/mastra/issues/17167).
