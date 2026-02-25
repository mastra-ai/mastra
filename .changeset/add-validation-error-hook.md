---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/hono': minor
'@mastra/express': minor
'@mastra/fastify': minor
'@mastra/koa': minor
---

Added `onValidationError` hook to `ServerConfig` and `createRoute()`. When a request fails Zod schema validation (query parameters, request body, or path parameters), this hook lets you customize the error response — including the HTTP status code and response body — instead of the default 400 response. Set it on the server config to apply globally, or on individual routes to override per-route. All server adapters (Hono, Express, Fastify, Koa) support this hook.

```ts
const mastra = new Mastra({
  server: {
    onValidationError: (error, context) => ({
      status: 422,
      body: {
        ok: false,
        errors: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
        source: context,
      },
    }),
  },
})
```
