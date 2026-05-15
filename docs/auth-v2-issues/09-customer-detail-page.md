# Customer detail page

## Type

Feature

## Priority

P1

## Estimate

1.5 days

## Description

Build the customer detail page showing a specific customer's info and providing a link to view their traces.

## Requirements

- [ ] Detail page at `/users/:customerId`
- [ ] Show customer info: ID, email/name (if available from provider)
- [ ] Show first seen / last active timestamps
- [ ] Link to filtered traces view for this customer
- [ ] Back navigation to users list
- [ ] Loading/error states

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Users                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     Customer: cust_abc123                                       │
│     Email: alice@example.com                                    │
│     Name: Alice Johnson                                         │
│                                                                 │
│     First seen: January 10, 2026                                │
│     Last active: 5 minutes ago                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Activity                                                        │
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│   View this customer's API activity and traces.                 │
│                                                                 │
│                    [View Traces →]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## "View Traces" Link

Links to `/traces?userId=cust_abc123` — filtered traces view for this customer.

**Requirement:** The traces page must support filtering by `resourceId`/`userId` query parameter.

## API Endpoint

```
GET /api/users/:customerId

Response:
{
  id: string,
  email?: string,
  name?: string,
  avatarUrl?: string,
  createdAt?: string,
  lastActiveAt?: string,
  metadata?: Record<string, unknown>
}
```

Requires `users:read` permission. Returns 403 if unauthorized, 404 if user not found.

## Traces Page Filter Support

**Good news:** The traces page already supports `filterUserId` and `filterResourceId` URL parameters!

See `packages/playground-ui/src/domains/traces/trace-filters.ts`:

```typescript
export const TRACE_PROPERTY_FILTER_PARAM_BY_FIELD = {
  // ...
  resourceId: 'filterResourceId',
  userId: 'filterUserId',
  // ...
}
```

The "View Traces" link should use one of these:

```
/traces?filterUserId=cust_abc123
// or
/traces?filterResourceId=cust_abc123
```

**Note:** Verify which field (`userId` vs `resourceId`) your traces actually use for customer identification. The link should match how customer IDs are stored in spans.

## Acceptance Criteria

- [ ] Detail page loads customer info from provider
- [ ] Shows first seen / last active timestamps
- [ ] "View Traces" links to `/traces?userId=<customerId>`
- [ ] Traces page supports userId filter
- [ ] 404 handling for invalid customer ID
- [ ] Back navigation works
- [ ] Responsive design

## Files to Create/Modify

- `packages/playground/src/pages/users/[customerId]/index.tsx` (new)
- `packages/playground-ui/src/domains/users/components/customer-detail.tsx` (new)
- `packages/server/src/server/handlers/users.ts` (add endpoint)
- `packages/playground/src/pages/traces/index.tsx` (add userId filter support)

## Dependencies

- 08-users-list-page

## Blocks

- 10-e2e-tests
