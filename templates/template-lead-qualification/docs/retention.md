# Preview and apply retention

Retention removes expired local content while preserving active work and minimal safety markers. Run maintenance with the application stopped and a consistent backup of both database files. The CLI acquires DuckDB's native process lock before opening operational storage; an active application prevents maintenance from reaching LibSQL mutations. It never contacts a CRM or model, starts workers, reloads the service or deletes remote records.

The defaults in `qualificationConfig.retention` are 30 days for assessment, contact, review, sales outcome and operational report details; 30 days for DuckDB telemetry; and 90 days for minimal delivery and applied-operation markers. Reducing a setting affects the next explicit apply. Maintenance uses current configured settings, preserving old assessment snapshots until their details expire.

```sh
node --env-file=.env --import tsx scripts/maintenance.ts --preview /tmp/lead-retention-preview.json
```

The preview includes content-free run IDs, native snapshot cleanup, eligible terminal Attio inbox IDs and delivery digests, expired delivery/cycle markers, eligible sales event IDs, protected counts and per-table DuckDB eligible counts. It does not change retention data. Normal store initialization can create additive tables. Inspect the exact scope and retain the preview before deletion.

```sh
node --env-file=.env --import tsx scripts/maintenance.ts --apply /tmp/lead-retention-preview.json
```

Apply validates the preview digest and policy, then previews the same cutoff again. Changed eligibility requires a new preview. Each operational cycle is rechecked immediately before its bounded atomic transaction. Work is capped at 100 cycles/rows per table by the default preview; the programmatic interface accepts 1–1000. Run preview again to continue. The CLI refuses to overwrite an existing preview file.

## What remains protected

- Accepted or dispatching intake, active reviews including overdue packets, and any uncertain, pending or conflicting output remain intact. Overdue records need operator reconciliation, not blind deletion.
- An active cycle protects every older cycle for the same destination, preserving predecessor and ownership checks during recovery.
- Terminal rich detail can expire even for the latest destination. A minimal run/cycle marker retains destination identifiers, assessment/predecessor IDs, terminal state, timestamps, last operation ID and exact projection fingerprints. These values carry no excerpts, prompt, inquiry, contact payload, justification or readable report.
- **Current ownership protection:** the latest destination ownership marker remains protected beyond 90 days because it prevents unlinked research and validates explicit requalification. Historical terminal markers can expire after 90 days when a newer cycle exists and that destination has no active work. The preview reports `protectedOwnershipMarkers`; the 90-day setting does not promise deletion of current ownership safety.

Eligible cleanup deletes research rounds, reservations, assessment/config snapshots, review history/packets, decisions, authorizations and exact output patches. The retained run event is reduced to technical reference bindings; local text/Markdown destination reports are removed only when still owned by that expired operation. Newer or active local reports are preserved. Native workflow snapshots are removed through the workflow storage API; a content-free `native_pending` marker makes an interrupted native deletion retryable. Completed/ignored Attio inbox payloads expire separately; pending, failed and conflicting notifications remain protected. Delivery payloads become digests until their marker window ends. Terminal Attio delivery digests expire after 90 days when their inbox is empty.

Sales outcomes expire only after both their event time and first local receipt are older than the 30-day detail window. Event insertion and first-receipt metadata are atomic and idempotent. A late-arriving old event receives its own full local retention window; replay does not extend it. Existing rows without receipt metadata receive one conservative first-observed timestamp at initialization. Active, failed, conflicting or uncertain-output cycles protect linked outcomes. Eligible orphan outcomes can expire independently of already-pruned assessment detail; each deletion also removes its receipt metadata. Preview and apply progress expose the bounded sales cleanup.

A retained duplicate delivery resolves to its original run ID without research. A changed payload under the same delivery identity is rejected. After a delivery marker expires, the per-destination terminal marker still requires explicit requalification. The run read API identifies expired details; its output endpoint no longer returns the old report. Same-assessment manual reopening needs retained assessment detail and is unavailable after expiry. A verified fresh Triage transition can create a linked Attio cycle only if its machine-owned output fingerprint and operation marker remain unchanged. Local requalification uses the same predecessor check and, when still present, the exact previous local projection.

## Independent store progress

Operational deletion, native workflow snapshot deletion and native DuckDB pruning are independently resumable. Apply returns completed run IDs, native cleanup IDs, inbox/marker counts, per-table native prune results and fixed failure codes. A failure in DuckDB cannot roll back operational deletion or replay business work. Keep the result and preview, investigate the unavailable store, and preview again. Native telemetry pruning uses the approved cutoff conservatively, allowing a one-second margin, so an additional preview may still show a few eligible rows. Bounded native results with `done: false` require another preview/apply.

No cross-database transaction or physical compaction is implied. Deleted pages may be reused without shrinking files. Maintenance cannot undo an external CRM write or restore deleted evidence; restore a consistent stopped-process backup to recover details. Keep backup access and expiry appropriate to its retained content. Reverting code alone does not undo pruning. The additive marker tables do not rewrite existing data until explicitly applied.

Customization prompt:

> Adapt retention for [operational requirement] using the existing preview/apply service and native storage APIs. Preserve active and uncertain work, minimal delivery/predecessor/ownership checks and content-free progress. Add isolated database cases for changed eligibility, native-store failure, pending recovery, duplicate delivery and fresh requalification. Document actual retained windows and operator cleanup before changing defaults; never delete real data as part of a code check.
