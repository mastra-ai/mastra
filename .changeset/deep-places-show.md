---
'@mastra/schema-compat': minor
---

JSON Schema `format` keywords are now enforced during validation. Before, values such as `"not-an-email"` for a `format: "email"` property passed. Now they fail. The standard formats (`email`, `uri`, `date-time`, `date`, `uuid`, `ipv4`, and the others from `ajv-formats`) are covered. `date-time` requires a timezone, so `"2024-01-01T10:00:00"` is rejected. The `formatMinimum` and `formatMaximum` keywords now take effect too.

**Who is affected**

Every plain JSON Schema validated through `toStandardSchema()`. Zod and other Standard Schema libraries are unchanged. This includes:

- **Structured output.** A plain JSON Schema `structuredOutput` schema is checked against `format`. A value that breaks a format fails the whole run with `Structured output validation failed`. The model doesn't get a chance to retry, unlike a tool call.
- **Tools and client tools.** `inputSchema`, `outputSchema`, `suspendSchema` and `resumeSchema` are all checked. A bad input goes back to the model as a validation error so it can retry.
- **MCP tool inputs.** If an MCP server declares `format: "date-time"` and the model sends `"2024-01-01"`, the call fails validation and the model gets the error. MCP output validation (`structuredContent`) is unchanged.
- **Workflows.** Plain JSON Schema `inputSchema`, `stateSchema` and `outputSchema`.

**Opting out**

When you call the JSON Schema adapter directly, pass `validateFormats: false` to turn format checks off:

```ts
import { toStandardSchema } from '@mastra/schema-compat/adapters/json-schema';

const schema = toStandardSchema(jsonSchema, { ajvOptions: { validateFormats: false } });
```

MCP and the core call sites (structured output, tools, workflows) don't accept Ajv options, so they can't opt out. Remove the `format` keyword from the schema, or use a Zod schema, if a format is too strict for your data.

**Custom formats**

Formats you pass through `ajvOptions.formats` still take precedence over the built-in ones:

```ts
import { toStandardSchema } from '@mastra/schema-compat/adapters/json-schema';

const schema = toStandardSchema(jsonSchema, {
  ajvOptions: { formats: { email: /@example\.com$/, slug: /^[a-z-]+$/ } },
});
```
