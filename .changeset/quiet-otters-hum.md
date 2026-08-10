---
'@mastra/factory': patch
---

Hardened the GitHub reconcile worker, the Platform Linear event worker, and the shared issue reconciler:

- Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
- Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
- Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
- `GithubReconcileWorker` now renews its lease while a sweep is in flight, so folding the issue sweep into the same tick can no longer let the lease expire and hand off to a replica mid-sweep. A `renewLease` result of `false` or a renewal error is treated as lease loss: the worker aborts before running the folded issue sweep and skips `releaseLease` so the new owner's TTL is not disturbed.
- The Platform Linear event worker no longer calls `listWorkspaces` in reconcile-only mode, so a workspace-listing outage cannot block the reconcile sweep.
- The Platform Linear event worker now resolves the project list once per event page rather than once per event, avoiding up to `EVENT_PAGE_SIZE` × N project scans per poll cycle.
