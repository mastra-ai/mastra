---
'@mastra/deployer': patch
'@mastra/core': patch
---

With `server.auth` set and no `server.cors.origin`, the server no longer sends `Access-Control-Allow-Credentials: true` for every reflected origin. Credentials are now on by default only when you list allowed origins in `server.cors.origin`, or set `server.cors.credentials` yourself.

If a browser app on another origin sends cookies to an auth-enabled server, list that app's origin:

```ts
// Before: credentials were sent for any reflected origin
server: { auth: yourAuth }

// After: allow your app's origin explicitly
server: { auth: yourAuth, cors: { origin: 'https://app.example.com' } }
```
