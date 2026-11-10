---
'@mastra/auth-neon': patch
---

Fixed `@mastra/auth-neon` so it works with hosted Neon Auth projects. Before this fix, requests failed to authenticate against a Neon Auth URL: JWT verification, session cookies, Studio sign-in and sign-up, and organization roles all called endpoints or cookie names that Neon Auth doesn't use.

**What changed**

- JWTs are verified with `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`, and their issuer and audience are checked.
- Session cookies use Neon Auth's `__Secure-neon-auth.session_token` name, so Studio stays signed in after sign-in.
- Studio sign-in and sign-up send the Origin header that Neon Auth requires. The `token` returned by `POST /api/auth/credentials/sign-in` is now a Neon Auth JWT that you can send as a bearer token.
- Signing out revokes the session in Neon Auth.
- `signUpEnabled: false` now rejects sign-up requests to the Mastra API, not only the Studio form.
- An expired bearer JWT no longer causes a 401 when the request also carries a valid session cookie.
- `MastraRBACNeon` reads the user's role in the active organization (or `organizationId`). Permissions now apply to requests, and the JWT `role` claim (`authenticated`) is no longer treated as a Mastra role.

Use the Neon Auth URL exactly as the Neon Console shows it:

```typescript
new MastraAuthNeon({
  baseUrl: 'https://ep-example-123456.neonauth.us-east-2.aws.neon.tech/neondb/auth',
});
```
