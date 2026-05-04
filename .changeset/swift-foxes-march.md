---
'@mastra/auth-workos': minor
---

Added `MastraFGAWorkos` provider for Fine-Grained Authorization using the WorkOS Authorization API. Implements `IFGAManager` interface with support for:

- Authorization checks (`check()`, `require()`, `filterAccessible()`)
- Resource management (`createResource()`, `getResource()`, `listResources()`, `updateResource()`, `deleteResource()`)
- Role assignments (`assignRole()`, `removeRole()`, `listRoleAssignments()`)
- `resourceMapping` and `permissionMapping` for translating Mastra resource types and permissions to WorkOS resource type slugs and permission slugs
- Organization scoping that denies access when the user is not a member of the configured organization
- Bearer-token / verified JWT support that carries service-token FGA context such as organization membership IDs, while ignoring JWT-derived memberships unless organization claims are trusted
- Membership caching and batched accessible-resource discovery for lower per-request latency
- Tenant inference and parent-resource filtering for scoped access checks
- Paginated organization membership lookup and limited concurrent FGA checks when filtering accessible resources
- Typed permission constants accepted in `permissionMapping`

```typescript
import { MastraFGAWorkos } from '@mastra/auth-workos';

const fga = new MastraFGAWorkos({
  organizationId: 'org_abc123',
  resourceMapping: {
    agent: { fgaResourceType: 'team', deriveId: ctx => ctx.user.teamId },
  },
  permissionMapping: {
    'agents:execute': 'manage-workflows',
  },
});

// Check whether a user can execute an agent
const allowed = await fga.check(user, {
  resource: { type: 'agent', id: 'my-agent' },
  permission: 'agents:execute',
});
```
