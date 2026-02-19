---
'@mastra/schema-compat': patch
'mastracode': patch
---

fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas

The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.
