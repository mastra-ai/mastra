---
'@mastra/auth-okta': minor
---

Added an `audience` option to `MastraAuthOkta` so bearer-token verification is no longer pinned to the OAuth client ID.

Previously the provider always required `aud` to equal the client ID, which is the audience of an Okta **ID token**. Okta **access tokens** carry the authorization server's audience instead, so machine-to-machine callers (MCP clients, CI jobs, service-to-service traffic) always got a 401 on an org authorization server. Those callers have no session cookie, so bearer was their only way in.

Set `audience` (or the `OKTA_AUDIENCE` environment variable) to the audience your tokens actually carry:

```typescript
// Before: only ID tokens whose aud is the client ID were accepted
const auth = new MastraAuthOkta({ domain, clientId, clientSecret, redirectUri });

// After: accept access tokens from an org authorization server
const auth = new MastraAuthOkta({
  domain,
  clientId,
  clientSecret,
  redirectUri,
  audience: 'https://your-org.okta.com',
});

// Or accept both ID tokens from the browser and access tokens from services
const auth = new MastraAuthOkta({ /* ... */ audience: [clientId, 'api://default'] });
```

The default is unchanged, so existing setups keep working.
