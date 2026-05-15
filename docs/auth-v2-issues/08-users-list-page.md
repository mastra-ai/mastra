# Users list page (customers)

## Type

Feature

## Priority

P1

## Estimate

2 days

## Description

Build the Users tab in Studio that lists external customers who interact with your API. Data comes from the `apiAuth` provider's `IUserListing` implementation.

## Requirements

- [ ] Add "Users" nav item in sidebar (requires `users:read` permission)
- [ ] Users list page at `/users`
- [ ] Table showing: customer ID, email (if available), name, last active
- [ ] Search by customer ID or email
- [ ] Pagination
- [ ] Click row to navigate to customer detail page
- [ ] Empty state when provider doesn't support `IUserListing`
- [ ] Loading/error states

## Permission Requirements

**Visibility:** Tab visible only if user has `users:read` permission

**Default roles with `users:read`:**

- ✅ owner
- ✅ admin
- ✅ member
- ❌ viewer

## Data Source

**MVP:** Users come from the `apiAuth` provider via `IUserListing.listUsers()`.

If the provider doesn't implement `IUserListing`:

- Show the tab (for discoverability)
- Display empty state: "User listing is not supported by your auth provider. Configure an auth provider that supports user management to see your customers here."

**Future enhancement (out of scope):** Fall back to trace-based user list (aggregate unique `resourceId` values from observability data).

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Users                                                   [Search]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Customer ID    │ Email              │ Name      │ Last Active   │
│────────────────┼────────────────────┼───────────┼───────────────│
│ cust_abc123    │ alice@example.com  │ Alice     │ 5 min ago     │
│ cust_def456    │ bob@example.com    │ Bob Smith │ 2 hours ago   │
│ cust_ghi789    │ —                  │ —         │ Yesterday     │
├─────────────────────────────────────────────────────────────────┤
│                        [Load more]                              │
└─────────────────────────────────────────────────────────────────┘
```

**Empty state (when IUserListing not supported):**

```
┌─────────────────────────────────────────────────────────────────┐
│ Users                                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         👥                                      │
│                                                                 │
│              User Listing Not Available                         │
│                                                                 │
│   Your auth provider doesn't support user listing.              │
│   Configure a provider like WorkOS to see your customers.       │
│                                                                 │
│                    [View Documentation]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoint

```
GET /api/users
  ?search=<string>
  &cursor=<string>
  &limit=<number>

Response:
{
  users: [
    {
      id: string,
      email?: string,
      name?: string,
      avatarUrl?: string,
      createdAt?: string,
      lastActiveAt?: string,
    }
  ],
  nextCursor?: string,
  total?: number,
  supported: boolean  // false if provider doesn't implement IUserListing
}
```

Requires `users:read` permission. Returns 403 if unauthorized.

## Acceptance Criteria

- [ ] Users nav item visible only with `users:read` permission
- [ ] Users list shows customers from `apiAuth` provider
- [ ] Search works
- [ ] Pagination works
- [ ] Clicking user goes to detail page
- [ ] Empty state when IUserListing not supported
- [ ] Responsive design
- [ ] Accessible (keyboard nav, screen readers)

## Files to Create/Modify

- `packages/playground/src/pages/users/index.tsx` (new)
- `packages/playground-ui/src/domains/users/` (new domain)
- `packages/playground-ui/src/lib/nav/nav-items.tsx` (add Users with `requiredPermission: 'users:read'`)
- `packages/server/src/server/handlers/users.ts` (new)
- `packages/core/src/auth/ee/defaults/roles.ts` (add `users:read` to default roles)

## Dependencies

- 02-request-routing
- 03-iuserlisting-interface
- 04-workos-userlisting

## Blocks

- 09-customer-detail-page
