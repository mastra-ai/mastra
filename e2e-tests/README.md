# E2E Tests

End-to-end tests for the Mastra monorepo.

## Architecture

```
e2e-tests/
├── _shared/                    # Shared utilities and setup
│   ├── setup/
│   │   ├── registry.ts         # Verdaccio registry management
│   │   ├── snapshot.ts         # Package versioning (no git mutations!)
│   │   └── project.ts          # Test project scaffolding
│   └── utils/
│       ├── server-ready.ts     # Robust server wait utilities
│       └── cleanup.ts          # Process and directory cleanup
│
├── templates/                  # Project templates for tests
│   ├── monorepo/              # Multi-package workspace
│   ├── cloudflare/            # Cloudflare worker project
│   ├── commonjs/              # CommonJS project
│   └── kitchen-sink/          # Full-featured playground test
│
├── suites/                     # Test suites
│   ├── monorepo/              # Monorepo build/dev/start tests
│   ├── deployers/             # Cloudflare/Vercel/Netlify deployers
│   ├── create-mastra/         # create-mastra CLI
│   ├── commonjs/              # CommonJS compatibility
│   ├── pkg-outputs/           # Package export validation
│   └── kitchen-sink/          # Playwright UI tests
│
├── setup.global.ts            # Single global setup for all tests
├── vitest.config.ts           # Base vitest config
├── vitest.workspace.ts        # Workspace config for test suites
└── package.json               # Unified dependencies
```

## Key Improvements Over Previous Architecture

### 1. No More Git Mutations

The old `prepareMonorepo()` function would:

- Create "SAVEPOINT" commits in your actual repo
- Modify all package.json files
- Run changeset commands that change repo state

The new architecture:

- Uses the same snapshot versioning approach BUT
- Stores original file contents in memory
- Restores everything on cleanup
- Never creates commits

### 2. Single Registry for All Tests

Previously, each test suite:

- Started its own verdaccio registry
- Published packages separately
- Had its own setup/teardown

Now:

- One global setup runs ONCE
- Single registry serves all tests
- Packages published once, used everywhere

### 3. Shared Utilities

Common patterns extracted:

- `waitForServer()` - HTTP-based server readiness (not stdout parsing)
- `waitForOutput()` - Stream pattern matching when needed
- `processManager` - Centralized process cleanup
- `createProject()` - Consistent project scaffolding

### 4. Unified Configuration

- Single `package.json` with all dependencies
- Vitest workspace for running specific suites
- Shared tsconfig

## Running Tests

```bash
# Install dependencies (from e2e-tests directory)
pnpm install

# Run all e2e tests
pnpm test

# Run specific suite
pnpm test:monorepo
pnpm test:deployers
pnpm test:create-mastra
pnpm test:commonjs
pnpm test:pkg-outputs

# Run Playwright kitchen-sink tests (separate runner)
pnpm test:kitchen-sink
```

## Adding New Tests

1. Create a new directory under `suites/`
2. Add your `*.test.ts` files
3. If needed, add a template under `templates/`
4. Add the suite to `vitest.workspace.ts`
5. Add a script to `package.json`

## Debugging

Set `DEBUG=true` for verbose output:

```bash
DEBUG=true pnpm test:monorepo
```

For individual test debugging:

```bash
pnpm vitest run --workspace vitest.workspace.ts --project monorepo --reporter=verbose
```
