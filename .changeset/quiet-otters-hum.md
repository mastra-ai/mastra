---
'@mastra/factory': patch
---

Hardened the Platform Linear event worker and the shared issue reconciler:

- Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
- Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
- Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
