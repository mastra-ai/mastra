# WorkOS IUserListing + IInvitations implementation

## Type

Feature

## Priority

P1

## Estimate

1.5 days

## Description

Implement `IUserListing` and `IInvitations` for `MastraAuthWorkos`. Support multiple data sources to accommodate different use cases.

**Design principle:** Don't assume how customers model their users. Make it configurable.

## Data Source Options

WorkOS has two relevant APIs:

| API                                  | Returns                         | Use Case                       |
| ------------------------------------ | ------------------------------- | ------------------------------ |
| `listUsers()`                        | All users in WorkOS environment | External customers (Users tab) |
| `listOrganizationMemberships(orgId)` | Members of specific org         | Internal team (Team tab)       |

The implementation should support both via configuration:

```typescript
// Option 1: List all users in environment (default)
const auth = new MastraAuthWorkos({
  userListing: 'all', // or just omit — default behavior
})

// Option 2: List members of a specific org
const auth = new MastraAuthWorkos({
  organizationId: 'org_xxx', // When set, listUsers() returns org members
})

// Option 3: Custom filter
const auth = new MastraAuthWorkos({
  userListing: {
    filter: user => user.email?.endsWith('@company.com'),
  },
})
```

## Requirements

### IUserListing

- [ ] Implement `listUsers()` using WorkOS User Management API
- [ ] Implement `getUserById()` using WorkOS API
- [ ] If `organizationId` configured, use `listOrganizationMemberships()`
- [ ] Otherwise, use `listUsers()` for all users
- [ ] Support pagination via WorkOS cursors
- [ ] Support search by name/email
- [ ] Map WorkOS user fields to `UserListItem`
- [ ] Handle rate limits gracefully
- [ ] Cache results where appropriate (LRU, short TTL)

### IInvitations

- [ ] Implement `sendInvitation()` using WorkOS Invitation API
- [ ] Implement `listInvitations()` for pending invites
- [ ] Implement `revokeInvitation()` to cancel pending invites
- [ ] WorkOS sends invitation emails automatically

## WorkOS API Usage

```typescript
// All users in environment
const users = await workos.userManagement.listUsers({
  limit: 20,
  after: cursor,
  email: searchTerm, // if searching
})

// Org members only
const memberships = await workos.userManagement.listOrganizationMemberships({
  organizationId: 'org_xxx',
  limit: 20,
  after: cursor,
})
// Then fetch user details for each membership

// Send invitation
const invitation = await workos.userManagement.sendInvitation({
  email: 'newuser@company.com',
  organizationId: 'org_xxx', // optional
})
// WorkOS sends the email automatically

// List pending invitations
const invitations = await workos.userManagement.listInvitations({
  organizationId: 'org_xxx',
})

// Revoke invitation
await workos.userManagement.revokeInvitation(invitationId)
```

## Field Mapping

| WorkOS Field             | UserListItem Field            |
| ------------------------ | ----------------------------- |
| `id`                     | `id`                          |
| `email`                  | `email`                       |
| `firstName` + `lastName` | `name`                        |
| `profilePictureUrl`      | `avatarUrl`                   |
| `createdAt`              | `createdAt`                   |
| `lastActiveAt`           | `lastActiveAt`                |
| membership.role          | `roles` (when using org mode) |

## Example Configuration

```typescript
// studioAuth: internal team members from your org
const studioAuth = {
  provider: new MastraAuthWorkos({
    apiKey: process.env.WORKOS_API_KEY,
    clientId: process.env.WORKOS_CLIENT_ID,
    redirectUri: 'https://studio.example.com/callback',
    organizationId: 'org_internal_team', // List org members
  }),
  rbac: new MastraRBACWorkos({ ... }),
};

// apiAuth: all customers who've authenticated
const apiAuth = {
  provider: new MastraAuthWorkos({
    apiKey: process.env.WORKOS_API_KEY,
    clientId: process.env.WORKOS_CLIENT_ID,
    redirectUri: 'https://api.example.com/callback',
    // No organizationId — lists all users
  }),
};
```

## Acceptance Criteria

### IUserListing

- [ ] `MastraAuthWorkos` implements `IUserListing`
- [ ] `listUsers()` returns all users when no `organizationId`
- [ ] `listUsers()` returns org members when `organizationId` set
- [ ] Pagination works correctly
- [ ] Search filters by name/email
- [ ] `getUserById()` returns full user details
- [ ] Results cached with short TTL (30-60s)

### IInvitations

- [ ] `MastraAuthWorkos` implements `IInvitations`
- [ ] `sendInvitation()` sends invite via WorkOS
- [ ] `listInvitations()` returns pending invites
- [ ] `revokeInvitation()` cancels pending invite

### Error Handling

- [ ] Unit tests with mocked WorkOS API
- [ ] Handles WorkOS errors gracefully (rate limits, network errors)

## Files to Modify

- `packages/core/src/auth/workos/src/auth-provider.ts`
- `packages/core/src/auth/workos/src/types.ts` (add options)

## Dependencies

- 03-iuserlisting-interface

## Blocks

- 05-team-list-page
- 08-users-list-page
