---
'@mastra/auth-clerk': minor
---

Added single-organization login restriction to `@mastra/auth-clerk`. Set `organizationId` or `organizationSlug` (or the `CLERK_ORGANIZATION_ID` / `CLERK_ORGANIZATION_SLUG` env vars) to only allow members of one Clerk organization to sign in. Non-members are denied during authorization and SSO callback.

```typescript
new MastraAuthClerk({
  jwksUri: process.env.CLERK_JWKS_URI,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  organizationId: process.env.CLERK_ORGANIZATION_ID,
});
```
