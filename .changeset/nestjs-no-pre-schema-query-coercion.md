---
'@mastra/nestjs': patch
---

Fixed `@mastra/nestjs` coercing query parameter values to booleans, `null`, numbers, and parsed JSON objects/arrays before route schema validation. A route declaring `queryParamSchema: z.object({ filter: z.string() })` could reject a valid request like `?filter={"a":1}` because the adapter had already turned the string into an object. NestJS now forwards query values as the raw strings (or string arrays) the HTTP layer delivered — matching `@mastra/hono`, `@mastra/express`, `@mastra/fastify`, and `@mastra/koa`.

Routes that want type coercion should opt in via the schema, e.g. `z.coerce.boolean()`, `z.coerce.number()`, or a JSON preprocessor on the field.

Fixes #16114.
