---
'@mastra/server': minor
'@mastra/hono': minor
'@mastra/express': minor
'@mastra/fastify': minor
'@mastra/koa': minor
---

Added explicit auth control to built-in API routes. All routes now have a requiresAuth property that determines whether authentication is required. This eliminates route matching overhead and makes auth requirements clear in route definitions. Routes default to requiresAuth: true (protected) for security. To make a route public, set requiresAuth: false in the route definition.
