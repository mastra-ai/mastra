---
'@mastra/server': patch
'@mastra/elysia': patch
---

Fixed `/api/openapi.json` containing `$ref`s that point nowhere. Recursive (`z.lazy`) schemas and schemas tagged with `.meta({ id })` used to emit `#/definitions/...` or `#/$defs/...` refs that broke once inlined into the document. Those definitions now go into `components.schemas` and the refs point there, so tools like Swagger UI, swagger-parser, and OpenAPI client generators can load the spec. This covers both built-in and custom routes. When two different schemas share an id, the second one gets a suffixed name (for example `Invoice_2`) and neither overwrites the other.
