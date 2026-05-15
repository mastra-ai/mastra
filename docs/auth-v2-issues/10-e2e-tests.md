# E2E tests for Auth v2

## Type

Testing

## Priority

**P1 — MVP requirement**

## Estimate

1.5 days

## Description

Write E2E tests covering the new Auth v2 features: Team management and Users visibility. These tests validate RBAC-gated access and UI functionality.

## Test Scenarios

### Team Tab Tests

```typescript
describe('Team Management', () => {
  test('user with team:read can view team list', async () => {
    // Login as member (has team:read)
    // Navigate to /team
    // Verify team members are listed
    // Verify search input is present
  })

  test('user without team:read cannot see Team tab', async () => {
    // Login as viewer (no team:read)
    // Verify Team nav item is NOT visible in sidebar
    // Navigate directly to /team
    // Verify 403 or redirect
  })

  test('admin can search team members', async () => {
    // Login as admin
    // Navigate to /team
    // Enter search term
    // Verify filtered results
  })

  test('can view team member detail', async () => {
    // Login as member
    // Navigate to /team
    // Click on team member
    // Verify detail page shows:
    //   - User info (name, email, avatar)
    //   - Roles
    //   - Permissions
  })

  test('user with team:write sees Manage Roles button', async () => {
    // Login as admin (has team:write)
    // Navigate to team member detail
    // Verify "Manage Roles" button is visible
  })

  test('user without team:write does NOT see Manage Roles button', async () => {
    // Login as member (no team:write)
    // Navigate to team member detail
    // Verify "Manage Roles" button is NOT visible
  })

  test('admin can assign role to team member', async () => {
    // Login as admin
    // Navigate to team member detail
    // Click "Manage Roles"
    // Assign new role
    // Verify role appears in user's roles
  })

  test('admin can remove role from team member', async () => {
    // Login as admin
    // Navigate to team member detail
    // Click "Manage Roles"
    // Remove role
    // Confirm in dialog
    // Verify role removed
  })
})
```

### Users Tab Tests

```typescript
describe('Customer Visibility', () => {
  test('user with users:read can view users list', async () => {
    // Login as member (has users:read)
    // Navigate to /users
    // Verify customers are listed
  })

  test('user without users:read cannot see Users tab', async () => {
    // Login as viewer (no users:read)
    // Verify Users nav item is NOT visible
    // Navigate directly to /users
    // Verify 403 or redirect
  })

  test('admin can search customers', async () => {
    // Login as admin
    // Navigate to /users
    // Enter search term
    // Verify filtered results
  })

  test('can view customer detail', async () => {
    // Login as member
    // Navigate to /users
    // Click on customer
    // Verify detail page shows customer info
  })

  test('can navigate to filtered traces from customer', async () => {
    // Login as admin
    // Navigate to customer detail
    // Click "View Traces"
    // Verify traces page opens with userId filter applied
    // Verify URL contains ?userId=<customerId>
  })

  test('empty state when IUserListing not supported', async () => {
    // Configure auth provider without IUserListing
    // Login as admin
    // Navigate to /users
    // Verify empty state message is shown
  })
})
```

### Auth Routing Tests

```typescript
describe('Auth Routing', () => {
  test('studio routes use studioAuth', async () => {
    // Configure studioAuth (e.g., Okta) + apiAuth (e.g., WorkOS)
    // Access /agents with valid Okta session
    // Verify access granted
    // Access /agents without Okta session
    // Verify redirected to Okta login
  })

  test('API routes use apiAuth', async () => {
    // Configure studioAuth + apiAuth
    // Call /api/agents with valid WorkOS token
    // Verify 200 response
    // Call /api/agents without token
    // Verify 401 response
  })

  test('spoofed studio header without session shows login', async () => {
    // Configure studioAuth (Okta) + apiAuth (WorkOS)
    // Call /agents with x-mastra-client-type: studio header
    // But WITHOUT valid Okta session
    // Verify 401 + login redirect (NOT fallback to apiAuth)
  })

  test('backwards compat: single auth works for both', async () => {
    // Configure only `auth` (no studio/api split)
    // Access studio routes — works
    // Access API routes — works
    // Both use same auth provider
  })
})
```

## Test Fixtures

Extend existing auth fixtures in `e2e/kitchen-sink/fixtures/`:

```typescript
// auth-roles.fixture.ts
export const teamMembers = [
  {
    id: 'user_admin',
    name: 'Admin User',
    email: 'admin@test.com',
    roles: ['admin'],
    permissions: ['*'],
  },
  {
    id: 'user_member',
    name: 'Member User',
    email: 'member@test.com',
    roles: ['member'],
    permissions: ['*:read', '*:execute', 'team:read', 'users:read'],
  },
  {
    id: 'user_viewer',
    name: 'Viewer User',
    email: 'viewer@test.com',
    roles: ['viewer'],
    permissions: ['*:read'], // No team:read, no users:read
  },
]

export const customers = [
  { id: 'cust_alice', email: 'alice@example.com', name: 'Alice' },
  { id: 'cust_bob', email: 'bob@example.com', name: 'Bob Smith' },
  { id: 'cust_anon', email: null, name: null }, // Anonymous customer
]
```

## Test Data Setup

For E2E tests, we need:

1. Mock auth providers that return predictable users
2. Mock RBAC that returns predictable permissions
3. Seeded team members and customers

Consider using MSW (Mock Service Worker) to intercept WorkOS API calls, or create a `MockUserListingProvider` for testing.

## Acceptance Criteria

- [ ] Team list permission tests pass
- [ ] Team member detail tests pass
- [ ] Role management tests pass
- [ ] Users list permission tests pass
- [ ] Customer detail tests pass
- [ ] Trace filter navigation tests pass
- [ ] Auth routing tests pass
- [ ] Header spoofing security test passes
- [ ] Tests run in CI

## Files to Create/Modify

- `packages/playground/e2e/tests/auth/team-management.spec.ts` (new)
- `packages/playground/e2e/tests/auth/customer-visibility.spec.ts` (new)
- `packages/playground/e2e/tests/auth/auth-routing.spec.ts` (new)
- `packages/playground/e2e/kitchen-sink/fixtures/auth-roles.fixture.ts` (extend)
- `packages/playground/e2e/kitchen-sink/fixtures/customers.fixture.ts` (new)

## Dependencies

- 07-role-management-ui
- 09-customer-detail-page

## Notes

E2E tests are MVP requirement per product decision. Ship with tests, not after.
