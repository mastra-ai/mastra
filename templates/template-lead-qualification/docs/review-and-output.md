# Review and output

Confirmed Qualified, Nurture, and Disqualified outcomes apply automatically. Uncertain assessments publish a review packet containing findings, evidence, missing facts, and suggested actions. Identity must be resolved before a final qualification can be approved.

## Decide a review

For operator review, open **Tools → reviewLead** in Studio or post to `/lead-qualification/reviews`. Copy the current `runId` and `business.packet` references from the run response:

```json
{
  "runId": "copy-the-run-uuid",
  "reviewId": "copy-the-packet-uuid",
  "revision": 1,
  "digest": "copy-the-packet-digest",
  "decision": "approved",
  "override": {
    "classification": "qualified",
    "reason": "Confirmed the employee range directly with the company."
  }
}
```

Replace all references, including revision, with current values. Decisions are `approved`, `rejected`, or `changes_requested`. Approving an uncertain classification requires a final disposition and a reason. When policy routes an otherwise confirmed result to review, approval can keep it without an override. Facts and computed score remain unchanged.

The first valid decision wins. An identical retry returns it; stale packets, conflicting decisions, or changed destination fields return 409. Rejection, requested changes, and expiry close the review without applying a final qualification. Expiry defaults to seven days.

With Attio input and output, the [verified Stage command](attio.md#review-by-stage) replaces operator approval. Other built-in provider combinations use Studio/API review.

## Read local reports

`GET /lead-qualification/runs/:runId/output` returns Markdown after a review is published or an outcome is applied. Add `?format=text` for plain text. Reports contain the outcome, score, findings, sources, and next action. CRM outputs remain in their configured destination.

Before writing, the service records the exact authorized patch and a stable operation ID. It compares owned fields, applies the patch, then checks read-back. A lost response is reconciled on retry. Changed fields become a conflict, preserving the destination for deliberate reconciliation. Local updates use atomic compare-and-set; Attio's API has a read/write race.

To research again after a terminal outcome, send a new event with the latest `supersedesAssessmentId`. See [intake](intake.md) and [output driver customization](crm-adapters.md).
