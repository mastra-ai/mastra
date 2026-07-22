---
'@mastra/auth-better-auth': patch
---

Fixed Better Auth bearer token authentication and implemented user lookup in `@mastra/auth-better-auth` (fixes [#19110](https://github.com/mastra-ai/mastra/issues/19110)).

**Bearer tokens now work after credentials sign-in**

`signIn`/`signUp` return Better Auth's raw session token, but Better Auth only accepts _signed_ session cookies. Sending that token as `Authorization: Bearer <token>` previously always failed authentication. The provider now signs unsigned tokens with the Better Auth secret before verifying the session — matching the semantics of Better Auth's bearer plugin. The session cookie name is also resolved from the Better Auth instance, so secure-cookie setups (`__Secure-` prefix) work too.

**`getUser()` and `getUsers()` are now implemented**

Previously `getUser()` was a stub that always returned `null`, breaking Studio user lookup and author enrichment. It now resolves users by ID through Better Auth's internal database adapter, and `getUsers()` supports batch lookups.
