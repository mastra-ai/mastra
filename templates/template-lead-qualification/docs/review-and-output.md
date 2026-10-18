# Review and local output

Confirmed Qualified, Nurture and Disqualified outcomes apply automatically. Score alone cannot authorize output: the stored facts, resolved identity, captured policy and deterministic classification must agree. Missing buying-intent evidence remains uncertain; Nurture requires supported absence of a recent signal, such as a verified old inquiry. An automatic result has decision source Automatic and review status Not required, without a human approval record.

`GET /lead-qualification/runs/:runId` exposes `business.state` separately from intake status. `intake_received` means the association and research step completed; it can coexist with `awaiting_review`. The business record contains its packet, immutable decision and exact output authorization. Local destination fields live in the operational database, alongside the output journal. Attio mapping, provisioning and connected review callbacks are not included.

## Decide a published review

Uncertain assessments publish a versioned packet and Needs review stage. Each reason carries a stable code, affected attribute, explanation, suggested action and applicable evidence references. Publication is read back before decisions are accepted. The packet binds the lead, destination, cycle, captured assessment, score and proposed owned fields to its digest.

In Studio, open **Tools → reviewLead**. Copy the following values from `business.packet` and provide the run ID. The same decision works through `POST /lead-qualification/reviews`:

```json
{
  "runId": "00000000-0000-4000-8000-000000000001",
  "reviewId": "00000000-0000-4000-8000-000000000002",
  "revision": 1,
  "digest": "copy-the-current-packet-digest",
  "decision": "approved",
  "override": {
    "classification": "qualified",
    "reason": "Confirmed the employee range directly with the company."
  }
}
```

Replace the example references and digest with actual packet values. A decision is `approved`, `rejected` or `changes_requested`. An uncertain classification requires an explicit final override (`qualified`, `nurture` or `disqualified`) and a nonempty reason. For a stricter routing policy that sends an otherwise confirmed classification to review, approval can retain that classification without an override. Every override preserves the computed score and discovered facts. Unresolved company identity blocks final output; correct the input and request requalification instead.

The trusted local operator is recorded as `local-operator`; caller-supplied reviewer identity is rejected. Local mode trusts the person with loopback access, including Studio. Production requires the configured bearer token for both this endpoint and native Studio/tool APIs. It identifies the configured operator, rather than providing individual user accounts. Native workflow resume data cannot create a decision or authorize output.

The first valid terminal decision wins atomically. An identical retry returns the same record; another decision, stale revision, stale digest, unpublished packet or changed destination receives HTTP 409. Invalid shapes receive 400, oversized bodies 413 and a wrong content type 415. Production authentication failures receive 401. Persistence/provider unavailability can return 503. Final application is asynchronous; inspect the run response after a successful decision.

Rejection, changes requested and expiry retain Needs review with their respective review status and apply no final qualification patch. Changes requested closes that revision without starting research again. Review expiry defaults to seven days, captured when the packet is created. The dispatcher restores suspended workflows, handles persisted decisions and expires eligible packets after restart. Human wait releases research capacity while the destination remains reserved.

## Output and recovery

The integration owns assessment/cycle IDs, classification, stage, score, summary, evidence links, gaps, structured review reasons, next action, review ID/revision/status, decision source and override classification/reason. Company facts and unrelated destination fields remain untouched. Each final patch is bound to a persisted policy or human authorization; incoming events, model text and resume payloads cannot supply it.

Before any write the application persists a stable operation ID, exact patch and expected owned fields. A local atomic compare-and-set preserves unrelated values and rejects concurrent edits. Application success requires the operation marker and exact fields to match on read-back. If a response is lost, the same journaled operation is reconciled before retry. Failed reads leave output pending and keep the cycle active. Missing records, changed stages or changed owned fields produce a visible conflict and prevent a conflicting re-enrollment. A confirmed operation is one logical effect; this does not claim exactly-once network delivery for future adapters.

For a conflict, stop competing edits, inspect the operational journal and destination, and resolve the conflicting values deliberately. No automatic overwrite or destructive reset is provided. Preserve the database during rollback; reverting code cannot undo an already applied result.

## Requalify explicitly

Send a new `lead.received` event with a new event ID, the same destination reference and `supersedesAssessmentId` equal to the latest terminal assessment ID. Eligible predecessors are applied, rejected, changes requested or expired cycles. No active cycle or unreconciled output may remain. The local record moves to Triage, then the new cycle researches with current evidence and configuration. Previous evidence, scores, decisions and delivery associations remain unchanged.

Duplicate deliveries return the new cycle's existing run. Delayed deliveries of the old event return its old association and never reset the latest destination. A matching domain alone does not establish a predecessor relationship, and no scheduled requalification runs.

## Add an output adapter

Implement `OutputProvider` in `src/mastra/providers/output.ts` and register its stable ID in the application provider map. `read` returns current fields plus the last operation marker; `apply` takes the existing destination identity, stable operation ID, exact owned patch and expected fields. Return authoritative read-back data and preserve all unowned values. A provider without atomic compare-and-set must document its read/write race and reconciliation guarantees. Never create deals, send messages or delete records in this boundary.

Customization prompt:

> Add [destination] through OutputProvider. Inspect review schemas, persisted authorization and the outbound journal first. Map only integration-owned fields, retain the operation marker, verify destination identity and expected stage, and reconcile uncertain writes before retry. Preserve local mode and the same review contract. Add controlled functional tests for missing records, competing edits, lost responses, restart, duplicate decisions and unowned fields. Document the provider's atomicity limits and configuration; do not provision resources or add outreach implicitly.
