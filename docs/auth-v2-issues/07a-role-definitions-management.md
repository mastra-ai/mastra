# Role definitions management

## Type

Feature

## Priority

P1 — MVP requirement

## Estimate

2.5 days

## Description

Enable admins to create, edit, and delete role definitions (the templates that define what permissions a role grants). This goes beyond just assigning existing roles to users — it's about managing the roles themselves.

**This requires the RBAC provider to implement `IRoleDefinitionManager`.** If the provider only implements `IRBACProvider` (read-only) or `IRBACManager` (without role definition CRUD), role definitions are read-only in the UI.

## The Distinction

| Concept             | What it is                     | Example                                                              |
| ------------------- | ------------------------------ | -------------------------------------------------------------------- |
| **Role Definition** | A template: name + permissions | "Editor" role grants `agents:read`, `agents:write`, `workflows:read` |
| **Role Assignment** | Binding a user to a role       | Sarah has the "Editor" role                                          |

**Issue 07 (Role Management UI)** handles role _assignment_ — giving users roles.
**This issue (07a)** handles role _definition_ — creating/editing the roles themselves.

## Interface: IRoleDefinitionManager

Extends `IRBACManager` with role definition CRUD:

```typescript
interface IRoleDefinitionManager<TUser = unknown> extends IRBACManager<TUser> {
  /**
   * Create a new role definition.
   * @throws if role with same ID already exists
   */
  createRoleDefinition(role: CreateRoleDefinitionInput): Promise<RoleDefinition>

  /**
   * Update an existing role definition.
   * Changes take effect immediately for all users with this role.
   */
  updateRoleDefinition(roleId: string, updates: UpdateRoleDefinitionInput): Promise<RoleDefinition>

  /**
   * Delete a role definition.
   * @throws if role is still assigned to users (must unassign first)
   */
  deleteRoleDefinition(roleId: string): Promise<void>

  /**
   * List all available permissions that can be assigned to roles.
   * Used to populate the permission picker UI.
   */
  listAvailablePermissions(): Promise<PermissionInfo[]>
}

interface CreateRoleDefinitionInput {
  id?: string // Auto-generated if not provided
  name: string
  description?: string
  permissions: string[]
  inherits?: string[] // Optional: inherit from other roles
}

interface UpdateRoleDefinitionInput {
  name?: string
  description?: string
  permissions?: string[]
  inherits?: string[]
}

interface PermissionInfo {
  id: string // e.g., "agents:read"
  name: string // e.g., "Read Agents"
  description?: string // e.g., "View agent configurations"
  resource: string // e.g., "agents"
  action: string // e.g., "read"
}
```

## Requirements

### Backend

- [ ] Define `IRoleDefinitionManager` interface
- [ ] Add `implementsRoleDefinitionManager()` type helper
- [ ] Add API endpoints for role definition CRUD
- [ ] Generate `PermissionInfo` list from route definitions

### Frontend

- [ ] "Roles" section in Team settings (or separate /roles page)
- [ ] List all role definitions with name, description, permission count
- [ ] "Create Role" button (opens modal)
- [ ] Create role modal: name, description, permission multi-select
- [ ] Edit role (click row or edit button)
- [ ] Delete role with confirmation
- [ ] Show warning if role has active assignments
- [ ] Read-only view when provider doesn't implement IRoleDefinitionManager

## Permission Requirements

| Action          | Permission                    |
| --------------- | ----------------------------- |
| View roles list | `team:read`                   |
| Create role     | `team:admin` or `roles:write` |
| Edit role       | `team:admin` or `roles:write` |
| Delete role     | `team:admin` or `roles:write` |

## UI Design

### Roles List

```
┌─────────────────────────────────────────────────────────────────┐
│ Roles                                           [+ Create Role] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Name        │ Description              │ Permissions │ Members  │
│─────────────┼──────────────────────────┼─────────────┼──────────│
│ Owner       │ Full access              │ 1 (*)       │ 1        │
│ Admin       │ Administrative access    │ 8           │ 3        │
│ Editor      │ Can edit agents/workflows│ 6           │ 12       │
│ Viewer      │ Read-only access         │ 4           │ 25       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Create/Edit Role Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Role                                            [× Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Name *                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Editor                                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Description                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Can view and edit agents and workflows                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Permissions                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ agents:read     ☑ agents:write    ☐ agents:execute       │ │
│ │ ☑ workflows:read  ☑ workflows:write ☐ workflows:execute    │ │
│ │ ☐ tools:read      ☐ tools:write     ☐ tools:execute        │ │
│ │ ☐ team:read       ☐ team:write      ☐ team:admin           │ │
│ │ ☐ users:read                                                │ │
│ │ ☐ observability:read                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Inherit from (optional)                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ None                                                     ▼  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                              [Cancel]  [Create Role]            │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

```
GET /api/auth/roles
Response: { roles: RoleDefinition[], canManage: boolean }

POST /api/auth/roles
Body: CreateRoleDefinitionInput
Response: { role: RoleDefinition }
Permission: team:admin

PUT /api/auth/roles/:roleId
Body: UpdateRoleDefinitionInput
Response: { role: RoleDefinition }
Permission: team:admin

DELETE /api/auth/roles/:roleId
Response: { success: true }
Permission: team:admin

GET /api/auth/permissions
Response: { permissions: PermissionInfo[] }
Permission: team:read
```

## WorkOS FGA Implementation

WorkOS FGA supports custom roles per organization. The implementation would:

1. Use FGA schema to define role→permission mappings
2. Store custom roles scoped to the organization
3. Sync permission changes immediately

```typescript
// Create custom role in WorkOS FGA
await workos.fga.writeWarrants({
  warrants: permissions.map(permission => ({
    resource_type: 'role',
    resource_id: roleId,
    relation: 'permission',
    subject: { resource_type: 'permission', resource_id: permission },
  })),
})
```

## Provider Support

| Provider           | IRoleDefinitionManager | Notes                            |
| ------------------ | ---------------------- | -------------------------------- |
| WorkOS FGA         | ✅ Implement           | Uses FGA custom roles            |
| StaticRBACProvider | ❌ Read-only           | Roles defined in code            |
| MastraStorageRBAC  | ✅ Implement (future)  | Roles in Mastra DB               |
| Clerk              | ❌ Read-only           | Roles managed in Clerk dashboard |
| Okta               | ❌ Read-only           | Roles managed in Okta            |

## Acceptance Criteria

- [ ] `IRoleDefinitionManager` interface defined and exported
- [ ] `implementsRoleDefinitionManager()` type helper works
- [ ] Roles list page shows all role definitions
- [ ] Can create new role with name, description, permissions
- [ ] Can edit existing role
- [ ] Can delete role (with confirmation)
- [ ] Warning shown if role has active assignments before delete
- [ ] Read-only view when provider doesn't support management
- [ ] Permission picker shows all available permissions
- [ ] Changes take effect immediately for assigned users

## Files to Create/Modify

- `packages/core/src/auth/ee/interfaces/rbac.ts` — Add IRoleDefinitionManager
- `packages/core/src/auth/workos/src/fga-provider.ts` — Implement interface
- `packages/server/src/server/handlers/auth.ts` — Add endpoints
- `packages/playground/src/pages/team/roles.tsx` (new)
- `packages/playground-ui/src/domains/team/components/roles-list.tsx` (new)
- `packages/playground-ui/src/domains/team/components/role-editor.tsx` (new)

## Dependencies

- 03-iuserlisting-interface (for interface patterns)
- 04-workos-userlisting (WorkOS integration patterns)

## Blocks

- 07-role-management-ui (role assignment uses role definitions)
- 10-e2e-tests
