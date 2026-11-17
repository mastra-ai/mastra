---
'@mastra/connect': patch
---

The `resourceId` callback on `userConnectRoutes()` now receives the authenticated user as a typed `MastraUser`, the same `user` that agent callbacks such as `tools` receive. You can read the ID without a cast, and the routes and the agent's tools derive the same resource ID from one value.

```typescript
// Before
userConnectRoutes({ resourceId: ({ user }) => (user as { id: string } | undefined)?.id });

// After
userConnectRoutes({ resourceId: ({ user }) => user?.id });
```

`user` is now the normalized user rather than the raw object your auth provider returned. To read provider-specific fields, use `requestContext.get('user')`.
