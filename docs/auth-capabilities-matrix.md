# Auth Capabilities Matrix

This document tracks the current state and desired state of auth capabilities across Mastra providers.

## Philosophy

**Mastra ethos: Users should be able to do whatever they want.**

The auth system should be fully configurable. Users can:

1. Use static config if they want simple, code-defined roles
2. Use provider-managed roles if they want to manage roles in WorkOS/Okta dashboards
3. Use Mastra storage if they want full dynamic control without external dependencies
4. Mix and match - e.g., provider auth + Mastra-stored roles

---

## Current State: Provider Capabilities

### RBAC Capabilities Matrix

| Capability                | WorkOS | Cloud | Okta | Studio | Static | **Desired**  |
| ------------------------- | :----: | :---: | :--: | :----: | :----: | :----------: |
| **Role Assignment Model** |
| Single role per user      |   ✅   |  ✅   |  ❌  |   ✅   |   ✅   | Configurable |
| Multiple roles per user   |   ❌   |  ❌   |  ✅  |   ❌   |   ❌   |      ✅      |
| **Role Management**       |
| List roles                |   ✅   |  ❌   |  ❌  |   ❌   |   ✅   |      ✅      |
| Create roles dynamically  |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| Update roles dynamically  |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| Delete roles dynamically  |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| **Role Assignment**       |
| Assign role to user       |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| Remove role from user     |  ❌\*  |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| **Permission Management** |
| List permissions          |   ✅   |  ✅   |  ✅  |   ✅   |   ✅   |      ✅      |
| Create custom permissions |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| Edit role permissions     |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| **Role Source**           |
| Provider-managed roles    |   ✅   |  ✅   |  ✅  |   ❌   |   ❌   |      ✅      |
| Config-defined roles      |   ✅   |  ✅   |  ✅  |   ✅   |   ✅   |      ✅      |
| Storage-backed roles      |   ❌   |  ❌   |  ❌  |   ❌   |   ❌   |      ✅      |
| **Advanced**              |
| Role inheritance          |   ❌   |  ❌   |  ❌  |   ❌   |   ✅   |      ✅      |
| Permission wildcards      |   ✅   |  ✅   |  ✅  |   ✅   |   ✅   |      ✅      |
| Caching                   |   ✅   |  ❌   |  ✅  |   ❌   |   ✅   |      ✅      |

\*WorkOS: removeRole throws because WorkOS uses single role per membership - changing roles requires assignRole

### FGA (Fine-Grained Authorization) Capabilities Matrix

| Capability                     | WorkOS | Cloud | Okta | Studio | Static | **Desired** |
| ------------------------------ | :----: | :---: | :--: | :----: | :----: | :---------: |
| **Resource Management**        |
| FGA enabled                    |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Create resources               |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Update resources               |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Delete resources               |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| List resources                 |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| **Hierarchical Resources**     |
| Parent-child relationships     |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Permission inheritance         |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| **Resource-Level Permissions** |
| Check access                   |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Assign role to resource        |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Remove role from resource      |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| List role assignments          |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |
| Filter accessible resources    |   ✅   |  ❌   |  ❌  |   ❌   |   ❌   |     ✅      |

---

## Capability Flags (Current Interface)

### RBACCapabilities

```typescript
interface RBACCapabilities {
  multiRole: boolean // Can user have multiple roles?
  dynamicRoles: boolean // Can roles be created/updated/deleted at runtime?
  providerManagedRoles: boolean // Are roles managed in external provider?
  permissionEditing: boolean // Can role permissions be modified?
  roleAssignment: boolean // Is assignRole/removeRole available?
  roleInheritance: boolean // Can roles inherit from other roles?
  roleSource: 'provider' | 'config' | 'storage' | 'hybrid'
}
```

### FGACapabilities

```typescript
interface FGACapabilities {
  enabled: boolean
  canCreateResources: boolean
  canAssignRoles: boolean
  hierarchicalResources: boolean
  resourceTypes: string[]
  availablePermissions: string[]
}
```

---

## Gap Analysis

### High Priority Gaps (Need for MVP)

| Gap                                 | Impact                                  | Solution                                   |
| ----------------------------------- | --------------------------------------- | ------------------------------------------ |
| No multi-role support (except Okta) | Users limited to single role            | Add multi-role to WorkOS, Static providers |
| No dynamic role creation            | Can't create roles from UI              | Add storage-backed role management         |
| No permission editing               | Can't customize role permissions        | Add storage-backed permission management   |
| No storage-backed RBAC              | Requires external provider for dynamic  | Create `MastraStorageRBAC` provider        |
| FGA only on WorkOS                  | Other providers can't do resource-level | Create `MastraStorageFGA` provider         |

### Medium Priority Gaps

| Gap                                 | Impact                            | Solution                              |
| ----------------------------------- | --------------------------------- | ------------------------------------- |
| removeRole not working on WorkOS    | Can only change roles, not remove | Document limitation, use assignRole   |
| No role inheritance (except Static) | Can't build role hierarchies      | Add inheritance to other providers    |
| Inconsistent caching                | Performance varies by provider    | Standardize caching strategy          |
| No audit logging                    | Can't track permission changes    | Add audit events for RBAC/FGA changes |

### Low Priority Gaps

| Gap                         | Impact                             | Solution                   |
| --------------------------- | ---------------------------------- | -------------------------- |
| No cross-provider role sync | Roles must be managed per-provider | Future: role federation    |
| No permission templates     | Users start from scratch           | Add common permission sets |
| No bulk operations          | Must assign roles one-by-one       | Add batch assignment APIs  |

---

## Desired Architecture

### Storage-Backed RBAC (New)

For users who want full dynamic control without external providers:

```typescript
// User configures storage-backed RBAC
const mastra = new Mastra({
  studio: {
    rbac: new MastraStorageRBAC({
      storage: libsqlStore,
      // Optional: seed with initial roles
      initialRoles: [
        { id: 'admin', name: 'Admin', permissions: ['*'] },
        { id: 'member', name: 'Member', permissions: ['*:read', '*:execute'] },
      ],
    }),
  },
})

// Now users can:
// - Create/update/delete roles via UI
// - Edit permissions on roles
// - Assign multiple roles to users
// - All persisted to Mastra storage
```

### Storage-Backed FGA (New)

For users who want resource-level permissions without WorkOS:

```typescript
const mastra = new Mastra({
  studio: {
    fga: new MastraStorageFGA({
      storage: libsqlStore,
      resourceTypes: ['agent', 'workflow', 'tool', 'project'],
    }),
  },
})

// Now users can:
// - Create authorization resources
// - Assign roles to specific resources
// - Check access at resource level
// - All without external FGA provider
```

### Hybrid Mode

Combine provider auth with storage-backed RBAC/FGA:

```typescript
const mastra = new Mastra({
  studio: {
    // Auth from WorkOS (SSO, user management)
    auth: new MastraAuthWorkos({ ... }),

    // RBAC from Mastra storage (full control)
    rbac: new MastraStorageRBAC({ storage }),

    // FGA from Mastra storage (full control)
    fga: new MastraStorageFGA({ storage }),
  },
});
```

---

## UI Adaptation Based on Capabilities

The UI should adapt based on what the configured provider supports:

### Roles Page

| Capability                 | UI Behavior                                             |
| -------------------------- | ------------------------------------------------------- |
| `dynamicRoles: true`       | Show "Create Role" button                               |
| `dynamicRoles: false`      | Hide "Create Role", show info about provider management |
| `permissionEditing: true`  | Allow editing permissions in role modal                 |
| `permissionEditing: false` | Show permissions as read-only                           |
| `roleAssignment: true`     | Show role assignment controls                           |
| `roleAssignment: false`    | Hide assignment, explain roles come from provider       |

### Team Member Detail Page

| Capability              | UI Behavior                                  |
| ----------------------- | -------------------------------------------- |
| `multiRole: true`       | Show checkboxes for multiple role selection  |
| `multiRole: false`      | Show radio buttons for single role selection |
| `roleAssignment: true`  | Show "Manage Roles" button                   |
| `roleAssignment: false` | Show current role as read-only               |

### Resources Page (FGA)

| Capability                 | UI Behavior                          |
| -------------------------- | ------------------------------------ |
| `fga.enabled: true`        | Show Resources page in nav           |
| `fga.enabled: false`       | Hide Resources page                  |
| `canCreateResources: true` | Show "Create Resource" button        |
| `canAssignRoles: true`     | Show role assignment UI on resources |

---

## Implementation Roadmap

### Phase 1: Complete Current Providers

- [ ] Add `multiRole` support to WorkOS (optional config)
- [ ] Implement all capability flags consistently
- [ ] Fix UI to properly check capabilities before showing controls

### Phase 2: Storage-Backed RBAC

- [ ] Create `MastraStorageRBAC` provider
- [ ] Schema: roles table, user_roles table, permissions table
- [ ] Full CRUD for roles and permissions
- [ ] Multi-role support by default

### Phase 3: Storage-Backed FGA

- [ ] Create `MastraStorageFGA` provider
- [ ] Schema: resources table, role_assignments table
- [ ] Parent-child resource hierarchies
- [ ] Permission inheritance

### Phase 4: Advanced Features

- [ ] Role templates / presets
- [ ] Bulk operations
- [ ] Audit logging for all RBAC/FGA changes
- [ ] Permission analytics / unused permission detection

---

## Questions to Resolve

1. **Multi-role on WorkOS**: WorkOS org memberships are single-role. Should we:
   - a) Store additional roles in Mastra storage (hybrid)
   - b) Document limitation and recommend multi-role providers
   - c) Use WorkOS FGA for additional permissions

2. **Permission granularity**: Current permissions are `resource:action`. Should we support:
   - Resource instance permissions (e.g., `agents:read:agent-123`)
   - Conditional permissions (e.g., `agents:read:own`)
   - Permission dependencies

3. **Role hierarchy**: How should inheritance work?
   - Flat inheritance (role A inherits all of role B)
   - Permission merging (union of all inherited permissions)
   - Override support (child can restrict parent permissions)

4. **Default behavior**: When no RBAC configured:
   - Current: All permissions granted (permissive)
   - Alternative: Require explicit RBAC config for production
