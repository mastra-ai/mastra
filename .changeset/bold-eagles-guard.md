---
'@mastra/core': minor
---

Added Fine-Grained Authorization (FGA) support for relationship-based, resource-level access control. FGA answers "can this user perform this action on this specific resource?" — enabling multi-tenant isolation and per-resource permissions.

**New interfaces:** `IFGAProvider` (read-only checks) and `IFGAManager` (read + write operations) with types for access checks, resources, and role assignments.

**Enforcement at all execution points:** FGA checks are automatically enforced before agent execution (`generate()`, `stream()`), tool execution, workflow execution, and memory thread access. When no FGA provider is configured, all checks are skipped (backward compatible).

**New utility:** `checkFGA()` provides centralized FGA enforcement with `FGADeniedError` for denied checks. `MastraMemory.checkThreadFGA()` adds thread-level access control.

**Request-aware authorization:** Resource ID resolvers receive request context so route-level FGA checks can derive tenant- or request-scoped resource IDs.

**Typed permission constants:** Strongly-typed permission identifiers (e.g. `'agents:execute'`, `'workflows:execute'`, `'memory:threads:read'`) for use in authorization config and `permissionMapping`.

```typescript
const mastra = new Mastra({
  server: {
    fga: new MastraFGAWorkos({ apiKey, clientId }),
  },
});
```
