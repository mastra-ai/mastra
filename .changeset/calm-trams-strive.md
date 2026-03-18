---
'@mastra/schema-compat': patch
---

fix(schema-compat): map Mastra draft target names to Zod v4 format

Zod v4's `z.toJSONSchema()` expects `"draft-7"` / `"draft-4"` while
Mastra uses `"draft-07"` / `"draft-04"`. The mismatch caused repeated
`Invalid target: draft-07` console warnings and suppressed the `$schema`
field in generated JSON Schemas.

Adds `ZOD_V4_TARGET_MAP` in the zod-v4 adapter to translate target names
before calling `z.toJSONSchema()`. `"draft-2020-12"` is unchanged as both
sides already agree on that name.

Fixes `#14399`
