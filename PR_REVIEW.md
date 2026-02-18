## Review

The fix is sound — nice catch on the race condition.

`setMastraContext()` calls `exporter.init()` without awaiting it, so spans exported before init finishes get silently dropped. The `waitForInit()` mechanism fixes this cleanly by having `_exportTracingEvent()` await a promise that resolves once any in-progress `init()` completes.

All previous nits have been addressed in the latest update:

- Type alias is now PascalCase (`Resolve`)
- Redundant `catch` block removed — now just `try/finally`
- Typos in comments fixed

The two new tests are well-targeted:
1. Verifies exports succeed when `init()` is not awaited (the actual race condition)
2. Verifies graceful logging when `init()` is never called at all

**Minor note** (pre-existing, not blocking): `setMastraContext` wraps `exporter.init()` in a `try/catch`, but since `init()` is async and not awaited, rejected promises won't be caught there. Worth a follow-up.

LGTM — approve.
