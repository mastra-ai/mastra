# Role assignment UI

## Type

Feature

## Priority

P1 — MVP requirement

## Estimate

1.5 days

## Description

Build UI for assigning and removing roles from team members. This is about _which users have which roles_, not about creating/editing the roles themselves (that's Issue 07a).

Requires the auth provider to implement `IRBACManager`.

**Note:** Issue 07a (Role Definitions Management) handles creating/editing roles. This issue handles assigning existing roles to users.

## Requirements

- [ ] Role management accessible from team member detail page
- [ ] Show all available roles
- [ ] Show which roles user currently has
- [ ] Assign role to user
- [ ] Remove role from user
- [ ] Show permissions for each role (expandable)
- [ ] Confirmation before removing roles
- [ ] Handle providers that don't support role management (read-only view)
- [ ] Require `team:write` permission to modify roles

## Permission Requirements

**View roles:** `team:read` permission (same as viewing team member)

**Modify roles:** `team:write` permission

**Default roles with `team:write`:**

- ✅ owner
- ✅ admin
- ❌ member
- ❌ viewer

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Manage Roles — Sarah Chen                              [× Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Current Roles                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ Admin                                          [Remove]   │ │
│ │   Permissions: *, team:write                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Available Roles                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Member                                         [Assign]   │ │
│ │   Permissions: agents:read, workflows:read, ...             │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ○ Viewer                                         [Assign]   │ │
│ │   Permissions: *:read                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Read-only view (when provider doesn't support IRBACManager or user lacks `team:write`):**

- Show current roles
- Show permissions
- Hide Assign/Remove buttons
- Show explanation: "Role management is handled by your identity provider" or "You don't have permission to modify roles"

## API Endpoints

```
GET /api/auth/roles
Response: { roles: RoleDefinition[] }
Permission: team:read

POST /api/auth/team/:userId/roles
Body: { role: string }
Response: { success: true }
Permission: team:write

DELETE /api/auth/team/:userId/roles/:role
Response: { success: true }
Permission: team:write
```

## Provider Requirements

Provider must implement `IRBACManager` for write operations:

- `listRoles()` — List available roles
- `assignRole(user, role)` — Assign role to user
- `removeRole(user, role)` — Remove role from user

If provider only implements `IRBACProvider` (read-only), show roles but disable modify actions.

## Acceptance Criteria

- [ ] Can view all available roles
- [ ] Can see user's current roles
- [ ] Can assign new role to user (with `team:write`)
- [ ] Can remove role from user (with `team:write`)
- [ ] Confirmation dialog before removing
- [ ] Shows permissions for each role
- [ ] Read-only view when provider doesn't support IRBACManager
- [ ] Read-only view when user lacks `team:write`
- [ ] Optimistic UI updates
- [ ] Error handling for failed operations

## Files to Create/Modify

- `packages/playground-ui/src/domains/team/components/role-manager.tsx` (new)
- `packages/playground/src/pages/team/[userId]/roles.tsx` (new, or modal)
- `packages/server/src/server/handlers/auth.ts` (add endpoints)
- `packages/server/src/server/routes/index.ts` (add routes)
- `packages/core/src/auth/ee/defaults/roles.ts` (add `team:write` to admin/owner)

## Dependencies

- 06-team-member-detail
- 07a-role-definitions-management (roles must exist to assign them)

## Blocks

- 10-e2e-tests
