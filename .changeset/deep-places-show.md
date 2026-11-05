---
'@mastra/schema-compat': minor
---

JSON Schema `format` keywords are now enforced during validation. Before, values such as `"not-an-email"` for a `format: "email"` property passed. Now they fail. The standard formats (`email`, `uri`, `date-time`, `date`, `uuid`, `ipv4`, and the others from `ajv-formats`) are covered.

**Who is affected**

Every plain JSON Schema validated through `toStandardSchema()`, including:

- Tools and client tools whose `inputSchema` is a plain JSON Schema
- MCP tool inputs. If an MCP server declares `format: "date-time"` and the model sends `"2024-01-01"`, the call now fails validation, and the model gets the error so it can retry.

MCP output validation (`structuredContent`) is unchanged.

**Custom formats**

Formats you pass through `ajvOptions.formats` still take precedence over the built-in ones:

```ts
toStandardSchema(schema, {
  ajvOptions: { formats: { email: /@example\.com$/, slug: /^[a-z-]+$/ } },
});
```
