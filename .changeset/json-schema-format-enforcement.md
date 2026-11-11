---
'@mastra/schema-compat': minor
---

Enforce JSON Schema `format` keywords instead of silently ignoring them. `JsonSchemaWrapper` now registers the standard `ajv-formats` validators before compiling a schema, so `format` values are actually checked and the `unknown format "<name>" ignored` warning is gone.

This applies to every plain JSON Schema that flows through `toStandardSchema`: structured output (`output`/`structuredOutput`), tool `inputSchema`/`outputSchema`/`suspendSchema`/`resumeSchema`, workflow `inputSchema`/`stateSchema`/`outputSchema`, and MCP tool input schemas. Zod schemas are unaffected — they already validate their own formats.

Two behavior changes follow from this:

- `date-time` follows RFC 3339 and requires a timezone offset, so `"2024-01-01T10:00:00"` is now rejected while `"2024-01-01T10:00:00Z"` passes.
- `formatMinimum`, `formatMaximum` and the `formatExclusive*` keywords now take effect, since they depend on a registered format.

A structured output that breaks a `format` now fails the run instead of being accepted. Tool and client-tool calls report a normal input validation failure instead.

Callers that invoke `toStandardSchema` directly can opt out with `ajvOptions: { validateFormats: false }`, or override individual formats with `ajvOptions.formats`, which still takes precedence over the built-in ones. The `MCPClient` and core call sites don't expose `ajvOptions`, so there is no opt-out there.

Fixes [#29385](https://github.com/mastra-ai/mastra/issues/29385).
