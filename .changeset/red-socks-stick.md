---
'@mastra/auth': patch
---

Fixed Studio showing unauthenticated state when using `MastraJwtAuth` with custom headers. `MastraJwtAuth` now implements the `IUserProvider` interface (`getCurrentUser`/`getUser`), so the Studio capabilities endpoint can resolve the authenticated user from the JWT Bearer token.

Also added an optional `mapUser` option to customize how JWT claims are mapped to user fields:

```typescript
new MastraJwtAuth({
  secret: process.env.JWT_SECRET,
  mapUser: payload => ({
    id: payload.userId,
    name: payload.displayName,
    email: payload.mail,
  }),
});
```

Closes #14350
