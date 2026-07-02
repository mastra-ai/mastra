---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters

The tenancy work in MASTRA-4438 and MASTRA-4445 added new named imports from
`@mastra/core/storage` into the store adapters — `DatasetTenancyFilters`,
`ExperimentTenancyFilters`, and `DeleteDatasetItemInput` — but did not bump the
adapters' peer floor for `@mastra/core`. Those symbols first ship in
`@mastra/core@1.49.0`, so a consumer pinning an older core (e.g. `1.42.1`) with
a newer store patch would fail at load time with a `SyntaxError: Named export
'DatasetTenancyFilters' not found`.

This raises the peer floor to `>=1.49.0-0` on all five adapters (`@mastra/libsql`,
`@mastra/pg`, `@mastra/mysql`, `@mastra/mongodb`, `@mastra/spanner`) so npm/pnpm
will refuse the mismatched install rather than break at runtime.

`@mastra/spanner` had been sitting at `>=1.0.0-0` since inception; this bump also
closes that long-standing gap.

No behavior change. Consumers already on a compatible core version are unaffected.
