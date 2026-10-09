---
'@mastra/core': minor
'@mastra/hono': minor
'@mastra/deployer': patch
'@mastra/factory': patch
---

Added an `afterAuth` phase for server middleware. Middleware declared with `phase: 'afterAuth'` runs after route authentication succeeds, with the authenticated user already on the request context, and is skipped on routes declared `requiresAuth: false`. Supported by the Hono adapter.

```ts
new Mastra({
  server: {
    middleware: [
      {
        path: '/api/*',
        phase: 'afterAuth',
        handler: async (c, next) => {
          const user = c.get('requestContext').get('user');
          // stamp request-scoped data derived from the user
          await next();
        },
      },
    ],
  },
});
```

The Hono adapter now also keeps renewed session cookies on custom route responses.

Factory now authenticates every request once, through core route auth. Its `/web/*` routes are private by default; only sign-in/connect flows, signature-verified webhooks, and the Slack connect landing stay public. Organization selection, personal-org bootstrap, and message authorship run as an `afterAuth` step. This closes several `/web/*` routes that answered without a session.
