---
'@mastra/inngest': patch
---

Updated JSDoc adapter examples to register Inngest at `/inngest/api` instead of `/api/inngest`. The Inngest deployment guide and the in-repo example projects use the same path.

**Why**

Mastra's server now rejects user-defined `apiRoutes[].path` values that start with the server's `apiPrefix` (default `/api`) because that prefix is reserved for built-in routes such as `/api/agents` and `/api/workflows`. Following the previous guide on a current `@mastra/core` caused the server to throw `Custom API route "/api/inngest" must not start with "/api"` at startup.

**Migration**

If you registered Inngest with the previous guide:

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

If you cannot change the path, set `server.apiPrefix` (for example `/_mastra`) to relocate Mastra's built-in routes and remember to update `server.auth.protected` and any `MastraClient` `apiPrefix` to match. See the [Inngest deployment guide](https://mastra.ai/guides/deployment/inngest) for the full walkthrough.
