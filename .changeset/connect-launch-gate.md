---
'@mastra/connect': patch
---

Gate end-user connect flows behind a launch route. The vendor authorization link is a bearer capability (anyone who opens it can bind their account to the pending connection), so it now stays server-side: the new `GET /connect/connections/:id/launch` route verifies the caller owns the pending session before 302-redirecting into the provider's OAuth flow, and a forwarded or leaked launch URL returns 404 for anyone but the session owner. The hosted connect page navigates its popup through the launch route automatically.

Breaking response change for custom UIs: `POST /connect/:provider/sessions` now returns `launchUrl` (a server-relative path to the launch route) instead of `connectUrl`. Migrate by navigating to the launch route with the user's session instead of the vendor link:

```diff
 const session = await fetch(`${serverUrl}/connect/linear/sessions`, {
   method: 'POST',
   headers: authHeaders,
 }).then(res => res.json());

-popup.location.href = session.connectUrl;
+// Same-origin authenticated navigation; the server verifies ownership
+// before redirecting into the vendor OAuth flow.
+popup.location.href = `${serverUrl}${session.launchUrl}`;
```
