# MastraAdmin Integration Tests

Integration tests for MastraAdmin, validating end-to-end functionality across all core providers.

## Prerequisites

- Docker and Docker Compose
- Node.js 22+
- pnpm

## Running Tests

### Local Development

```bash
# Start Docker services, run tests, and clean up
pnpm test

# Run tests with coverage reporting
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Docker Services

The tests require PostgreSQL, ClickHouse, and Redis:

```bash
# Start services manually
pnpm docker:up

# Stop services and clean up volumes
pnpm docker:down
```

### Running Specific Test Suites

```bash
pnpm test:auth          # Authentication tests
pnpm test:teams         # Team management tests
pnpm test:projects      # Project CRUD tests
pnpm test:deployments   # Deployment lifecycle tests
pnpm test:observability # Observability data flow tests
pnpm test:router        # Route registration tests
pnpm test:storage       # File storage tests
pnpm test:rbac          # Role-based access control tests
pnpm test:errors        # Error handling tests
```

## CI Integration

Tests run automatically in GitHub Actions:

1. Triggered after the "Quality assurance" workflow completes
2. Changes to `@mastra/admin` packages are detected using Turborepo
3. Docker services (PostgreSQL, ClickHouse, Redis) run as GitHub Actions services
4. Coverage reports are uploaded as artifacts

### CI Scripts

```bash
# Run tests with CI configuration (includes JUnit reports)
pnpm test:ci
```

### Artifacts

- Coverage reports: `coverage/` directory
- Test results: `test-results/junit.xml`

## Environment Variables

The `.env.test` file contains test environment configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://mastra:mastra@localhost:5444/mastra_admin_test` |
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint | `http://localhost:8124` |
| `ADMIN_LICENSE_KEY` | License key for dev mode | `dev` |
| `ADMIN_ENCRYPTION_SECRET` | 32-byte encryption secret | `test-secret-key-32-bytes-long!!!` |

## Test Structure

```
src/
├── fixtures/           # Test data factories
│   ├── factories.ts
│   └── observability-factories.ts
├── helpers/            # Test helper functions
│   └── assertions.ts
├── setup/              # Test setup utilities
│   ├── global-setup.ts
│   ├── docker-setup.ts
│   ├── test-context.ts
│   └── mock-*.ts
└── tests/              # Test suites by domain
    ├── auth/
    ├── teams/
    ├── projects/
    ├── deployments/
    ├── observability/
    ├── router/
    ├── storage/
    ├── rbac/
    └── errors/
```

## Coverage Targets

| Category | Target |
|----------|--------|
| Auth/User operations | 90%+ |
| Team management | 90%+ |
| Project CRUD | 90%+ |
| Deployment lifecycle | 85%+ |
| Build workflow | 85%+ |
| Observability data flow | 80%+ |
| RBAC permissions | 95%+ |
| Error handling | 90%+ |
| Route registration | 85%+ |
