---
"@mastra/auth-neon": minor
---

Added Neon Auth adapter for managed authentication with Neon's Better Auth service. Supports JWT bearer token verification via JWKS, session cookie verification, email/password sign-in and sign-up for Studio, and custom authorization logic.

**Usage:**
```typescript
import { MastraAuthNeon } from '@mastra/auth-neon';

const auth = new MastraAuthNeon({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
});
```
