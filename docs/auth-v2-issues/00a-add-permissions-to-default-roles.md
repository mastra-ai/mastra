# Add team/users permissions to DEFAULT_ROLES

## Type

Chore

## Priority

P1

## Estimate

0.5 days (can be done as part of Issue 05)

## Description

Add the new `team:read`, `team:write`, and `users:read` permissions to the default role definitions.

## Current DEFAULT_ROLES

```typescript
// packages/core/src/auth/ee/defaults/roles.ts
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: ['*'],
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access',
    permissions: ['*:read', '*:write', '*:execute'],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard member access',
    permissions: ['*:read', '*:execute'],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['*:read'],
  },
]
```

## Updated DEFAULT_ROLES

```typescript
export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: ['*'], // Already covers team:*, users:*
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access',
    permissions: ['*:read', '*:write', '*:execute', 'team:read', 'team:write', 'users:read'],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard member access',
    permissions: ['*:read', '*:execute', 'team:read', 'users:read'],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['*:read'], // NO team:read, NO users:read
  },
]
```

## Permission Summary

| Permission   | Owner   | Admin | Member | Viewer |
| ------------ | ------- | ----- | ------ | ------ |
| `team:read`  | ✅ (\*) | ✅    | ✅     | ❌     |
| `team:write` | ✅ (\*) | ✅    | ❌     | ❌     |
| `users:read` | ✅ (\*) | ✅    | ✅     | ❌     |

## Why Viewer Doesn't Get These

Per product decision: viewers should only see the resources they work with (agents, workflows, etc.), not internal team structure or customer data.

## Acceptance Criteria

- [ ] `team:read` added to admin, member
- [ ] `team:write` added to admin only
- [ ] `users:read` added to admin, member
- [ ] Existing wildcard permissions on owner still cover everything
- [ ] Unit tests updated to verify new permissions
- [ ] Permission matching tests pass

## Files to Modify

- `packages/core/src/auth/ee/defaults/roles.ts`
- `packages/core/src/auth/ee/defaults/roles.test.ts` (if exists, add tests)

## Dependencies

None — can be done early

## Blocks

- 05-team-list-page
- 08-users-list-page
