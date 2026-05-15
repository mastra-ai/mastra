# Team member detail page

## Type

Feature

## Priority

P1

## Estimate

1.5 days

## Description

Build the team member detail page showing a specific team member's info, roles, and permissions.

## Requirements

- [ ] Detail page at `/team/:userId`
- [ ] Show user profile: avatar, name, email
- [ ] Show user's current roles
- [ ] Show effective permissions (derived from roles)
- [ ] Show last active timestamp
- [ ] Show member since date
- [ ] Back navigation to team list
- [ ] "Manage Roles" button (visible if user has `team:write`)
- [ ] Loading/error/404 states

## Permission Requirements

**View detail:** `team:read` permission (same as viewing list)

**Manage roles button:** Visible only if user has `team:write` permission

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Team                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     ┌───────┐                                                   │
│     │  👤   │  Sarah Chen                                       │
│     └───────┘  sarah@company.com                                │
│                                                                 │
│     Member since: January 15, 2026                              │
│     Last active: 2 minutes ago                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Roles                                              [Manage →]   │
│─────────────────────────────────────────────────────────────────│
│ • Admin                                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Effective Permissions                                           │
│─────────────────────────────────────────────────────────────────│
│ agents:read    agents:write    agents:execute                   │
│ workflows:read workflows:write workflows:execute                │
│ team:read      team:write                                       │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoint

```
GET /api/auth/team/:userId

Response:
{
  id: string,
  email: string,
  name: string,
  avatarUrl?: string,
  roles: string[],
  permissions: string[],      // Server computes from roles
  createdAt: string,
  lastActiveAt?: string,
  metadata?: Record<string, unknown>
}
```

Requires `team:read` permission. Returns 403 if unauthorized, 404 if user not found.

## Permissions Resolution

The `permissions` field is computed **server-side** from the user's roles:

```typescript
// In API handler
const user = await studioAuth.getUserById(userId)
const roles = await rbacProvider.getRoles(user)
const permissions = await rbacProvider.getPermissions(user)

return {
  ...user,
  roles,
  permissions, // Already resolved by RBAC provider
}
```

This uses the existing `IRBACProvider.getPermissions()` method which:

1. Gets user's roles
2. Applies role mapping (if configured)
3. Resolves inherited permissions
4. Returns flat permission array

## "Manage Roles" Button

- Only visible if current user has `team:write` permission
- Navigates to role management modal/page (Issue 07)
- Use `usePermissions().hasPermission('team:write')` to conditionally render

## Acceptance Criteria

- [ ] Detail page loads user info via API
- [ ] Shows all roles assigned to user
- [ ] Shows derived permissions from roles (server-computed)
- [ ] "Manage" button visible only with `team:write` permission
- [ ] "Manage" button navigates to role management (Issue 07)
- [ ] 404 handling for invalid user ID
- [ ] Back navigation works
- [ ] Responsive design
- [ ] Accessible

## Files to Create/Modify

- `packages/playground/src/pages/team/[userId]/index.tsx` (new)
- `packages/playground-ui/src/domains/team/components/team-member-detail.tsx` (new)
- `packages/playground-ui/src/domains/team/hooks/use-team-member.ts` (new)
- `packages/server/src/server/handlers/auth.ts` (add endpoint)

## Dependencies

- 05-team-list-page

## Blocks

- 07-role-management-ui
