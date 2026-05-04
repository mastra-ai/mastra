# Storage/Provider Migration Smoke Pattern

Use this when a release includes storage/provider schema, init, or migration changes. The goal is to prove the released provider package works against a real backend and repairs the old/broken schema state.

## Pattern

1. Start the affected backend locally when feasible.

   ```bash
   docker run -d --name mastra-smoke-pg \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=mastra \
     -p 5544:5432 \
     postgres:16
   ```

2. Add the released provider package to the generated smoke project.

   ```bash
   pnpm add @mastra/pg@alpha pg
   # or, for stable smoke:
   pnpm add @mastra/pg@latest pg
   ```

3. Configure the smoke project to use the provider through public Mastra config.
4. Enable the feature that depends on the changed schema, such as observational memory.
5. Create or mutate backend state to mimic the pre-fix schema.
6. Restart the Mastra dev server so provider init/migration runs from the released package.
7. Verify the missing column/table/index is restored.
8. Run a real API/UI flow that writes and reads through the affected provider path.

## Example evidence: Postgres observational-memory migration

For a Postgres observational-memory migration fix, collect evidence such as:

- `information_schema.columns` shows the missing column exists after restart, for example `reflectedObservationLineCount`
- an agent call using PG-backed memory succeeds
- a second call recalls the test phrase/thread context
- memory messages and observational memory rows exist in Postgres

Record the backend image/version, package version, schema mutation, verification query, and API result in `smoke-report.md`.
