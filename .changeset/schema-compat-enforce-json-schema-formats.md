---
'@mastra/schema-compat': minor
---

JSON Schema `format` keywords are now enforced when validating a plain JSON Schema

Previously a `format` (`email`, `uri`, `date-time`, ...) declared in a plain JSON Schema was ignored: the
value passed validation and Ajv logged `unknown format "..." ignored in schema at path "..."`. The formats
from `ajv-formats` are now registered on the Ajv instance used by `toStandardSchema()`, so invalid values
are rejected instead.

This affects every plain JSON Schema validated through `toStandardSchema()` — MCP tool inputs, core tool
schemas and structured output. Schemas written with Zod or another Standard Schema library are unaffected.

Two related changes come with it:

- `format` is now checked, so values that used to be accepted are rejected. `date-time` requires a timezone
  offset (`2026-11-05T10:00:00Z`, not `2026-11-05T10:00:00`).
- `formatMinimum` / `formatMaximum` on `date` / `date-time` now take effect.

Pass `ajvOptions: { validateFormats: false }` to validate without format checks.

Fixes [#29385](https://github.com/mastra-ai/mastra/issues/29385)
