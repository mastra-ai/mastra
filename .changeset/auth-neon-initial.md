---
"@mastra/auth-neon": minor
---

Added Neon Auth adapter for managed authentication with Neon's Better Auth service.

- `MastraAuthNeon` — JWT verification via JWKS, session cookie verification, email/password sign-in/sign-up for Studio, full `ISessionProvider` implementation
- `MastraRBACNeon` — Role-based access control mapping Neon Auth organization roles (`owner`/`admin`/`member`) to Mastra permissions, with LRU caching

**Usage:**
```typescript
import { MastraAuthNeon, MastraRBACNeon } from '@mastra/auth-neon';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthNeon({ baseUrl: process.env.NEON_AUTH_BASE_URL }),
    rbac: new MastraRBACNeon({
      roleMapping: { owner: ['*'], admin: ['*'], member: ['agents:read', 'workflows:*'], _default: [] },
    }),
  },
});
```
