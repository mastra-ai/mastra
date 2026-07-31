---
'@mastra/deployer-vercel': patch
---

Fixed custom API routes being unreachable when deploying to Vercel with `studio: true`.

Routes registered with `registerApiRoute()` are mounted at the root of the server, but the generated Vercel route table only forwarded `/api/*` and `/health` to your app. Every other path fell through to Studio's `index.html`, so a request to a custom route returned the Studio HTML page and the handler never ran. Moving the route under `/api` was not an option either, since that prefix is reserved for built-in routes.

The route table now serves the paths Studio owns from the CDN and sends everything else to your server, so custom routes behave the same as they do with `mastra dev` and `studio: false`. Studio and its assets are still served as static files with no function invocations.

```ts
export const mastra = new Mastra({
  deployer: new VercelDeployer({ studio: true }),
  server: {
    apiRoutes: [registerApiRoute('/my/webhook', { method: 'POST', handler: c => c.json({ ok: true }) })],
  },
});
```

`POST /my/webhook` now returns `{"ok":true}` instead of Studio's `index.html`.

Requests to a custom `server.apiPrefix` now reach your server too, instead of being answered with the Studio page. Studio's own UI still calls `/api`, so pointing Studio at a custom prefix is not supported yet.
