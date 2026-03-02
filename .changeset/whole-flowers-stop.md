---
'@mastra/playground-ui': patch
'mastra': patch
'create-mastra': patch
---

Add dual Zod v3/v4 compatibility to playground-ui form system

- Add `compat.ts` layer with runtime version detection (`_zod` for v4, `_def` for v3) and version-agnostic accessors for schema properties (shape, innerType, defaultValue, checks, options, etc.)
- Refactor `zod-provider/index.ts` to implement `SchemaProvider` directly instead of extending `@autoform/zod/v4`'s `ZodProvider`, removing the hard dependency on Zod v4
- Refactor `default-values.ts` and `field-type-inference.ts` to use compat helpers instead of v4-specific `_zod.def` access and `z.core.$ZodType` checks
- Refactor `dynamic-form.tsx` to use structural type detection instead of `instanceof ZodObject`/`ZodIntersection` checks that fail across Zod versions
- Remove `@autoform/zod` dependency (no longer needed)
- Move `zod` from direct dependency to peerDependency (`^3.25.0 || ^4.0.0`) so consuming apps provide their own version
