# @mastra/mysql

MySQL provider for Mastra - includes both vector and db storage capabilities.

## Stable v1.5 Compatibility

This version has been adapted to meet the stable v1.5 contract for Mastra storage adapters. It supports:
- Full observability/tracing (spans, traces)
- Workflow run management
- Thread and message persistence
- Scoring and evaluation storage

To verify compatibility:
```bash
pnpm typecheck
pnpm test test/storage/index.unit.test.ts
```

## Running the test suite

### Unit tests (no database required)

Run unit tests that don't require a database connection:

```bash
# Run all unit tests
pnpm test test/storage/domains/utils.test.ts test/storage/index.unit.test.ts

# Or run just the unit test file
pnpm test test/storage/index.unit.test.ts
```

### Integration tests (requires Docker)

The integration test suite uses Docker to run a MySQL instance:

```bash
# Ensure Docker is running, then run all tests including integration tests
pnpm test
```

This will automatically start a MySQL container, run the tests, and clean up afterwards.

## Environment Variables

You can override the default database connection settings:

- `MYSQL_HOST` (default: localhost)
- `MYSQL_PORT` (default: 3306)
- `MYSQL_USER` (default: mastra)
- `MYSQL_PASSWORD` (default: mastra)
- `MYSQL_DB` (default: mastra)

## Rollback Procedure

If issues arise with this version, follow these steps to rollback:

1. Checkout the last known good commit:
   ```bash
   git checkout <last-known-good-commit>
   ```
2. Reinstall dependencies:
   ```bash
   pnpm install
   ```
3. Verify the previous state:
   ```bash
   pnpm typecheck
   pnpm test test/storage/index.unit.test.ts
   ```

## Notes

- Integration tests require Docker to be running
- The test suite includes both unit tests and integration tests
- Unit tests use mocked MySQL connections and run quickly without external dependencies
- Integration tests verify real database interactions and require a running MySQL instance
- AI tracing features (span creation, updates, pagination, and batch operations) are **not currently implemented** for the MySQL adapter. Observability tables are not initialized and `supports.observabilityInstance` is `false` to avoid unexpected runtime errors.
