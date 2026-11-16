# Operations

Use one application process per persistent `data/` directory. `application.db` contains intake, assessments, decisions, journals, and workflow snapshots. `observability.duckdb` contains technical telemetry.

## Deploy

Set `LEAD_QUALIFICATION_MODE=production` and a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters. Production binds to `0.0.0.0` and requires bearer authentication for Studio and application APIs. Provider selection remains independent; both default to local. Set `LEAD_QUALIFICATION_PORT` to override port 4111.

Build with `npm run build`, then run `npm start` behind HTTPS ingress. Preserve `data/` across deployments. Back up both databases with the application stopped, and shut down gracefully to drain work and flush telemetry.

## Recover work

Restart with the same database files and provider mappings. Accepted events, completed research rounds, budgets, review decisions, and output operations remain durable. The dispatcher reconciles uncertain writes before retrying them, including when a connection fails while reading a successful Attio response body.

Inspect `business.state`, attempts, retry time, and failure code in the run response. A conflict means the destination changed or an operation can't be safely reconciled. Resolve the competing edit before continuing; clearing markers or resetting counters can repeat effects. Reverting code doesn't undo a CRM write.

## Maintenance

Retention defaults to 30 days for terminal assessment details and telemetry, and 90 days for historical delivery/cycle markers. Current destination ownership markers remain to prevent unsafe reuse. Active reviews, pending work, and uncertain outputs are protected.

With the application stopped, preview cleanup:

```bash
node --env-file=.env --import tsx scripts/observability/maintenance.ts --preview /tmp/lead-retention.json
```

Inspect the preview, then apply that exact scope:

```bash
node --env-file=.env --import tsx scripts/observability/maintenance.ts --apply /tmp/lead-retention.json
```

Apply rechecks eligibility. Changed scope requires a new preview. Work is bounded, so another preview/apply may be needed. Cleanup removes local detail and snapshots, retaining safety fingerprints; it doesn't delete CRM records. Store cleanup can progress independently after a failure. Keep the result and preview, investigate failures, and preview again before continuing.
