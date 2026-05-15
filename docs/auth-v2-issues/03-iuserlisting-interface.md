# IUserListing interface

## Type

Feature

## Priority

P1

## Estimate

0.5 days

## Description

Define the `IUserListing` interface that auth providers can implement to support listing users. This enables both the Team tab (internal users from `studioAuth`) and Users tab (external customers from `apiAuth`).

**Design principle:** The interface should be generic and not assume any specific provider's data model. Providers decide what "users" means in their context.

## Requirements

- [ ] Define `IUserListing<TUser>` interface
- [ ] Support pagination (cursor-based)
- [ ] Support search/filter
- [ ] Return user metadata (id, email, name, avatar, roles)
- [ ] Type-safe and well-documented
- [ ] Type helper to check if provider implements IUserListing

## Proposed Interface

```typescript
/**
 * Represents a user in a list view.
 * All fields except `id` are optional — providers may have varying levels of user data.
 */
interface UserListItem {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
  roles?: string[]
  createdAt?: Date
  lastActiveAt?: Date
  metadata?: Record<string, unknown>
}

/**
 * Options for listing users.
 * All fields are optional — providers should ignore unsupported filters gracefully.
 */
interface UserListOptions {
  /** Search by name or email */
  search?: string
  /** Filter by role (if provider supports roles) */
  role?: string
  /** Pagination cursor */
  cursor?: string
  /** Page size (default 20, max 100) */
  limit?: number
}

interface UserListResult {
  users: UserListItem[]
  /** Cursor for next page, undefined if no more */
  nextCursor?: string
  /** Total count if available (some providers can't provide this efficiently) */
  total?: number
}

/**
 * Interface for auth providers that can list users.
 *
 * Used by:
 * - Team tab: lists internal users from studioAuth provider
 * - Users tab: lists external customers from apiAuth provider
 *
 * What "users" means depends on the provider configuration.
 */
interface IUserListing<TUser> {
  /**
   * List users with optional filtering and pagination.
   * May require admin permissions depending on provider.
   */
  listUsers(options?: UserListOptions): Promise<UserListResult>

  /**
   * Get a single user by ID with full details.
   * Returns null if user not found.
   */
  getUserById(userId: string): Promise<TUser | null>
}

/**
 * Interface for auth providers that support invitations.
 * Optional — only implement if provider supports inviting users.
 */
interface IInvitations {
  /**
   * Send an invitation to join the organization.
   * Provider handles email delivery (e.g., WorkOS sends the email).
   */
  sendInvitation(options: { email: string; role?: string; organizationId?: string }): Promise<{ invitationId: string }>

  /**
   * List pending invitations.
   */
  listInvitations?(options?: { cursor?: string; limit?: number }): Promise<{
    invitations: Array<{
      id: string
      email: string
      role?: string
      state: 'pending' | 'accepted' | 'expired' | 'revoked'
      createdAt: Date
      expiresAt: Date
    }>
    nextCursor?: string
  }>

  /**
   * Revoke a pending invitation.
   */
  revokeInvitation?(invitationId: string): Promise<void>
}
```

## Type Helpers

```typescript
/**
 * Check if an auth provider implements IUserListing.
 * Use this before calling listUsers/getUserById.
 */
function implementsUserListing<TUser>(
  provider: MastraAuthProvider<TUser>,
): provider is MastraAuthProvider<TUser> & IUserListing<TUser> {
  return typeof (provider as any).listUsers === 'function' && typeof (provider as any).getUserById === 'function'
}

/**
 * Check if an auth provider implements IInvitations.
 * Use this before showing invite UI.
 */
function implementsInvitations(provider: MastraAuthProvider<any>): provider is MastraAuthProvider<any> & IInvitations {
  return typeof (provider as any).sendInvitation === 'function'
}
```

## Usage Pattern

```typescript
// In API handler for Team list
const studioAuth = getStudioAuthProvider(mastra)
if (!implementsUserListing(studioAuth)) {
  return { users: [], supported: false }
}
const result = await studioAuth.listUsers({ search, cursor, limit })

// In API handler for Users list
const apiAuth = getApiAuthProvider(mastra)
if (!implementsUserListing(apiAuth)) {
  return { users: [], supported: false }
}
const result = await apiAuth.listUsers({ search, cursor, limit })
```

## Acceptance Criteria

- [ ] `IUserListing` interface defined in `packages/core/src/auth/interfaces/user-listing.ts`
- [ ] `IInvitations` interface defined in `packages/core/src/auth/interfaces/invitations.ts`
- [ ] Both exported from auth package
- [ ] JSDoc comments explain usage
- [ ] Type helpers `implementsUserListing()` and `implementsInvitations()` exported
- [ ] Unit tests for type helpers

## Files to Create/Modify

- `packages/core/src/auth/interfaces/user-listing.ts` (new)
- `packages/core/src/auth/interfaces/index.ts` (export)

## Dependencies

None

## Blocks

- 04-workos-userlisting
- 05-team-list-page
- 08-users-list-page
