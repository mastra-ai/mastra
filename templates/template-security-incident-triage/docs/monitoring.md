# Local monitoring

The application migrates its operational database to v5 on normal startup. This adds an append-only, scalar-only analytics journal with atomic triggers for workflow, approval, incident-provider delivery and containment-attempt changes. No evidence bodies, identity details, decision reasons, tokens, provider references or trace capabilities enter the journal. Tenant/incident identifiers remain sensitive metadata. Protect and retain the journal and derived files accordingly; the journal currently has no automatic retention deletion.

Run an incremental export and tenant report with explicit paths (the command never loads `.env`, migrates the source or connects to a remote database):

```sh
npm run analytics:report -- --input /absolute/operational.db --analytics /absolute/derived.duckdb --output /absolute/new-report.json --tenant tenant-local
```

The output path must be new. Reuse the derived DuckDB path to incrementally export; choose a new DuckDB path to rebuild from the journal. Source database identity, tenant and monotonic sequence scope every cursor. Page inserts and cursor advancement commit together; replay exports zero rows. Separate source identities cannot mix, even with matching incident IDs. A customer implementation of `AnalyticsStore` must preserve these guarantees. Run only one exporter per DuckDB file at a time; cursor conflicts fail safely and can be retried.

Metrics are observed samples, with `NO_DATA` for absent denominators. Triage latency measures journal observation of workflow creation to authoritative triage-result persistence, not receipt-to-resolution time. Backfilled workflows have no observed start boundary and do not receive invented latencies. Approval latency uses persisted request and decision/expiry-resume times. Pending means no recorded decision or expiry resume, not a wall-clock validity judgment. Provider and containment failure rates describe the latest recorded entity outcome. Investigation source gaps come from committed `evidence.correlated` timeline events. Only explicit TIMEOUT, UNAVAILABLE, RATE_LIMITED, INVALID_RESPONSE, ABORTED and NOT_FOUND reasons enter the source-failure numerator; partial or empty evidence is a separate gap. The denominator is three source observations per committed correlation, not all tool attempts.

`workflowCarrierCoverage` measures the presence of a persisted workflow trace carrier. Full span completeness is `NO_DATA` in this read model: carrier presence cannot prove delivery of every Mastra span. Full traces remain in Mastra observability. The journal uses atomic triggers on existing mutations; it does not add telemetry writes to workflow or tool execution boundaries.

Escalation accuracy requires explicit reviewed labels; absence means `NO_DATA`. Pass `--labels /absolute/reviewed.json` containing an array of `{ "tenantId": "tenant-local", "incidentId": "...", "actualEscalated": true, "expectedEscalated": true, "reviewedBy": "reviewer-id", "reviewedAt": "2026-09-05T00:00:00Z" }`. Labels must match the selected tenant and known incidents, without duplicates. These are human-reviewed observations, not inferred operational truth. Reviewer identity is validated but excluded from the report.

DuckDB runs embedded in the process. No Redis, broker or paid analytics service is required. Analytics never authorizes containment or changes approval state.

Blocked containment attempts are counted separately as `containmentBlocked`. The execution-failure denominator includes only completed, failed and timed-out attempts; blocked or still-executing attempts cannot fabricate a successful execution rate. Local operational direct writes share the existing transaction write queue; this queue does not coordinate independent Mastra storage connections.
