---
'@mastra/auth-studio': minor
---

Added `fetchAsRequestUser(request, path, init)` to `MastraAuthStudio`. It calls the Mastra platform API as the signed-in user of an incoming request, so your server can act on the organization that user's session is on without its own platform token. It resolves to `null` when the request has no Mastra session, and gives up after 15 seconds unless you pass your own `signal`.

```ts
import { MastraAuthStudio } from '@mastra/auth-studio';

const auth = new MastraAuthStudio();

const response = await auth.fetchAsRequestUser(request, '/auth/me');
if (!response) {
  // The request has no Mastra session: ask the user to sign in.
}
```

When a call renews the user's session, later calls for the same request send the renewed session, so several platform calls can run in one request. Add the headers from `consumePendingResponseHeaders(request)` to your response so the browser keeps the renewed session.
