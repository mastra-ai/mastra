---
'@mastra/inngest': patch
---

Updated the `serve` and `createServe` JSDoc adapter examples to register Inngest at `/inngest/api` instead of `/api/inngest`, matching the Inngest deployment guide and in-repo example projects.

**Why**

Mastra reserves the `/api` prefix for built-in routes (agents, workflows, memory). Custom `apiRoutes[].path` values that start with the server's `apiPrefix` (default `/api`) are rejected at startup, so the previous JSDoc snippets threw `Custom API route "/api/inngest" must not start with "/api"` when copy-pasted into a current Mastra project.

**Migration**

If you registered Inngest with the previous guide or JSDoc example:

```ts
// Before
apiRoutes: [
  {
    path: '/api/inngest',
    method: 'ALL',
    createHandler: async ({ mastra }) => serve({ mastra, inngest }),
  },
]

// After
apiRoutes: [
  {
    path: '/inngest/api',
    method: 'ALL',
    createHandler: async ({ mastra }) => serve({ mastra, inngest }),
  },
]
```

Update the dev server URL (`npx inngest-cli dev -u http://localhost:4111/inngest/api`) and, in production, set the **URL** field on your Inngest app to match.

If you cannot change the path, set `server.apiPrefix` (for example `/_mastra`) to relocate the built-in routes and remember to update `server.auth.protected` and any `MastraClient` `apiPrefix` to match. See the [Inngest deployment guide](https://mastra.ai/guides/deployment/inngest) for the full walkthrough.
