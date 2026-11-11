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

- `format` is now checked, so values that used to be accepted are rejected. For `date-time`, replace values
  without a timezone (before: `2026-11-05T10:00:00`) with timezone-qualified values (after:
  `2026-11-05T10:00:00Z` or `2026-11-05T10:00:00+00:00`).
- `formatMinimum` / `formatMaximum` on `date` / `date-time` now take effect.

For direct `@mastra/schema-compat` callers, validate a timezone-qualified value:

```ts
import { toStandardSchema } from '@mastra/schema-compat/adapters/json-schema';

const schema = { type: 'string', format: 'date-time' } as const;
const result = toStandardSchema(schema)['~standard'].validate('2026-11-05T10:00:00Z');
```

If direct callers need the previous behavior, use
`toStandardSchema(schema, { ajvOptions: { validateFormats: false } })`. MCP tool inputs, core tool schemas,
and structured output do not expose this opt-out; supply format-valid values for those paths instead.

Fixes [#29385](https://github.com/mastra-ai/mastra/issues/29385)
