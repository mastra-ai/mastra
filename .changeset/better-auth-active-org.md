---
'@mastra/auth-better-auth': patch
---

Resolve a default `activeOrganizationId` from the user's oldest existing membership when the stored better-auth session has no `activeOrganizationId` set. Nothing in a default sign-in flow calls the organization plugin's `setActive`, so the field was always null and org-scoped consumers saw users with no organization.

```ts
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';

const mastraAuth = new MastraAuthBetterAuth({ auth });
const user = await mastraAuth.authenticateToken(token, request);
// Populated even when the sign-in flow never called `setActive`.
console.log(user?.session.activeOrganizationId);
```

The resolution is read-only and best-effort: the session row is not mutated, users with no memberships still authenticate, and a failed lookup falls back to today's behavior. Caveats: the resolved value is an inferred default, not an explicit user selection, and a session whose active organization was deliberately cleared via `setActive` is indistinguishable from one that was never set, so it also receives the default. A membership removed by an administrator stops being applied to new sessions within about a minute.
