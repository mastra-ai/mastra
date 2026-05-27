---
'@mastra/nestjs': patch
---

Switched the internal Zod error check to use the shared `isZodError` helper from `@mastra/server`, removing a duplicated local implementation and keeping behavior consistent with the other server adapters under dual-`zod` consumer setups.

`ValidationError.zodError` is now typed as `ZodErrorLike` (a structural subset of `ZodError` exposing `issues[]`) so that consumers pinning a different `zod` major than the one bundled with this adapter still type-check. The runtime value is unchanged and still supports all `ZodError` methods — cast to your installed `ZodError` type if you need them.

Related to [#17167](https://github.com/mastra-ai/mastra/issues/17167).
