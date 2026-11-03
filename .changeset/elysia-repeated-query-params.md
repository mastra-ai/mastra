---
'@mastra/elysia': patch
---

The Elysia adapter now keeps every value of a repeated query parameter (`?tag=a&tag=b` reads as `['a', 'b']`), matching the other adapters. `authorize` can also read `context.get('requestContext')` and `context.get('mastra')`, as on Hono.
