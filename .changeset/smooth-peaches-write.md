---
'@mastra/core': minor
---

Renamed CostGuardProcessor to CostControlProcessor, hardened it, and added new budgeting options.

**Rename**

- `CostGuardProcessor` is now `CostControlProcessor` with processor id `'cost-control'`. The `CostGuardProcessor` export (and the `CostGuardOptions`, `CostGuardUsage`, `CostGuardBreakdownEntry`, `CostGuardTripwireMetadata`, and `CostGuardViolationDetail` types) remains available as a deprecated alias for the same class and will be removed in a future major version.

**Improvements**

- Cost is now fetched in a single aggregate query instead of two, reducing storage load.
- Diagnostics now go through the Mastra logger, and cost query failures are logged instead of silently swallowed (the guard still fails open and never blocks on missing cost data).
- With the warn strategy, warnings and the onViolation callback now fire at most once per request instead of on every step.
- Violation messages no longer contain float precision artifacts (e.g. 0.30000000000000004 now renders as 0.3).

**New options**

- `warnAtPercent`: soft threshold that warns (without blocking) when cost reaches a percentage of the limit.
- `maxCost` now also accepts a function of RequestContext for per-tier or per-user budgets.
- New scopes `user`, `organization`, and `session` track cumulative cost per userId, organizationId, and sessionId (read from the matching RequestContext keys; traces must carry the matching span metadata).
- `includeBreakdown`: attaches a per-provider/model cost breakdown to violations.

```typescript
const costControl = new CostControlProcessor({
  maxCost: requestContext => (requestContext?.get('tier') === 'pro' ? 10.0 : 1.0),
  scope: 'user',
  warnAtPercent: 80,
  includeBreakdown: true,
});
```
