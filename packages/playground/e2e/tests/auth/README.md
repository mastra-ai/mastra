# Auth/RBAC E2E Tests

End-to-end tests for WorkOS authentication and role-based access control (RBAC) in Mastra Playground.

## Test Structure

```
tests/auth/
├── README.md                 # This file
├── infrastructure.spec.ts  # F001: Test infrastructure validation (implemented)
├── login-flow.spec.ts        # F002: Login flow tests (implemented)
├── admin-role.spec.ts        # F005: Admin role tests (implemented)
├── member-role.spec.ts       # F006: Member role tests (implemented)
├── viewer-role.spec.ts       # F007: Viewer role tests (implemented)
├── signup.spec.ts            # F003: Sign-up flow tests (not started)
├── logout.spec.ts            # F004: Logout flow tests (not started)
├── unauthorized.spec.ts      # F008: Unauthorized access tests (not started)
├── session-expiry.spec.ts    # F009: Session expiry tests (not started)
└── role-switching.spec.ts    # F010: Role switching tests (not started)
```

### Known gaps

- **F007** (`viewer-role.spec.ts`): `viewer only sees sidebar links for permitted resources` is skipped until viewer RBAC/sidebar expectations match Observability (Metrics can stay visible while Traces is hidden).
- **F003–F004, F008–F010**: Spec files are not created yet; see [Test Categories](#test-categories) for priority.

## Role Permissions (from PRD)

| Role      | Permissions                                                 |
| --------- | ----------------------------------------------------------- |
| admin     | `*` (full access)                                           |
| member    | `agents:read`, `workflows:*`, `tools:read`, `tools:execute` |
| viewer    | `agents:read`, `workflows:read`                             |
| \_default | (no permissions)                                            |

## Test Utilities

### Setting Up Mock Auth

The tests use Playwright's route interception to mock auth endpoints. Use the helpers from `__utils__/auth.ts`:

```typescript
import { setupAdminAuth, setupMemberAuth, setupViewerAuth, setupUnauthenticated } from '../__utils__/auth';

// Set up admin user
await setupAdminAuth(page);

// Set up member user
await setupMemberAuth(page);

// Set up viewer user
await setupViewerAuth(page);

// Set up unauthenticated state
await setupUnauthenticated(page);
```

### Custom Auth Configuration

For more control, use `setupMockAuth` with custom options:

```typescript
import { setupMockAuth } from '../__utils__/auth';

// Custom user data
await setupMockAuth(page, {
  role: 'member',
  user: {
    id: 'custom_id',
    email: 'custom@example.com',
    name: 'Custom User',
  },
});

// Custom permissions
await setupMockAuth(page, {
  role: 'viewer',
  permissions: ['agents:read', 'agents:write'], // Override default viewer permissions
});

// Disabled RBAC (all permission checks return true)
await setupMockAuth(page, {
  role: 'viewer',
  rbacEnabled: false,
});
```

## Running Tests

```bash
# From packages/playground/e2e directory
CI=true npx playwright test -c playwright.config.ts tests/auth/

# Run specific test file
CI=true npx playwright test -c playwright.config.ts tests/auth/login-flow.spec.ts

# Run with UI mode for debugging
npx playwright test --ui tests/auth/
```

## Environment Variables

For tests that require real WorkOS integration (optional):

| Variable                 | Description                        |
| ------------------------ | ---------------------------------- |
| `WORKOS_API_KEY`         | WorkOS API key                     |
| `WORKOS_CLIENT_ID`       | WorkOS client ID                   |
| `WORKOS_REDIRECT_URI`    | OAuth redirect URI                 |
| `WORKOS_COOKIE_PASSWORD` | Session cookie encryption password |

For mocked tests (default), no environment variables are needed.

## Test Categories

Status: **done** = spec file exists and runs (may include skipped tests); **not started** = no spec file yet.

### P0 (Critical)

- **F001**: E2E Test Infrastructure Setup — **done** (`infrastructure.spec.ts`)
- **F002**: Login Flow E2E Tests — **done** (`login-flow.spec.ts`)
- **F005**: Admin Role E2E Tests — **done** (`admin-role.spec.ts`)
- **F006**: Member Role E2E Tests — **done** (`member-role.spec.ts`)
- **F007**: Viewer Role E2E Tests — **done** (`viewer-role.spec.ts`; one skipped test)

### P1 (Important)

- **F003**: Sign Up Flow E2E Tests — **not started**
- **F004**: Logout Flow E2E Tests — **not started**
- **F008**: Unauthorized Access E2E Tests — **not started**

### P2 (Nice to Have)

- **F009**: Session Expiry E2E Tests — **not started**
- **F010**: Role Switching E2E Tests — **not started**
