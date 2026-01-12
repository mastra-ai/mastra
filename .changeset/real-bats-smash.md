---
'@mastra/schema-compat': patch
---

Fix oneOf schema conversion generating invalid JavaScript

The upstream json-schema-to-zod library generates TypeScript syntax (`reduce<z.ZodError[]>`) when converting oneOf schemas. This TypeScript generic annotation fails when evaluated at runtime with Function(), causing schema resolution to fail.

The fix removes TypeScript generic syntax from the generated output, producing valid JavaScript that can be evaluated at runtime. This resolves issues where MCP tools with oneOf in their output schemas would fail validation.
