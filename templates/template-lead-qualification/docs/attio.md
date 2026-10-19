# Qualify leads in Attio

Connect a dedicated company list to the same sourced qualification workflow used locally. New entries in Triage receive an automatic outcome or an actionable packet in Needs review. SDRs resolve pending reviews by moving **Stage**. Summary presents the accepted outcome and Metadata retains its structured status; Justification is optional. The immutable assessment preserves the original algorithmic result, score, evidence and history.

## Generate the workspace mapping

Create a workspace token in [Attio developer settings](https://app.attio.com/settings/developers) and set `ATTIO_API_TOKEN` in `.env`. Setup needs company-object reads and `list_configuration:read-write` to create missing resources. Runtime needs `record_permission:read`, `object_configuration:read`, `list_entry:read-write` and `list_configuration:read`. Keep the webhook signing secret in `ATTIO_WEBHOOK_SECRET` when enabling the server.

From the template directory, select an existing dedicated company list and inspect the plan:

```sh
node --env-file=.env --import tsx scripts/attio-setup.ts --list-id <list-uuid>
```

Or explicitly request a dedicated new list:

```sh
node --env-file=.env --import tsx scripts/attio-setup.ts --new-list "Lead Qualification Demo" --list-slug lead_qualification_demo
```

Both commands read metadata only. They do not create resources or write configuration. After inspecting the plan, repeat the same command with `--apply`. Setup discovers the workspace and companies object, verifies the selected list, reuses compatible attribute/option identifiers and creates only missing resources. Re-running resumes partial setup. Ambiguous names, incompatible types, archived mapped fields or missing previously mapped options stop setup without replacing the existing mapping.

`--apply` writes the complete secretless `attio.mapping.json` at the template root. Replacement is atomic, and a previous file is preserved in `attio.mapping.json.bak`. Both paths and temporary mapping files are ignored by Git and use owner-only permissions. Existing limits and optional sales mappings are retained. Tokens, request headers and raw API responses are not printed or written to the mapping. The CLI, dev server and generated server share project-root resolution, including `MASTRA_PROJECT_ROOT`.

Before applying or switching mappings, stop intake and the application, back up the operational database, and reconcile active Attio reviews, pending inbox events and unresolved writes. Setup checks the local database and refuses replacement while these exist. It does not delete or repair existing CRM records, rotate secrets, create webhooks or modify webhook subscriptions. Keep the application stopped through setup so new work cannot race the check.

## Fields and configuration

The shared definitions in `src/mastra/config/attio.ts` drive setup, runtime validation and fixtures. New mappings capture `layoutVersion: 2` and create exactly four attributes. The three SDR-facing fields are Stage, Summary and Justification; keep the technical Metadata field out of the everyday board view.

| Field         | Type   | Purpose                                                                                       |
| ------------- | ------ | --------------------------------------------------------------------------------------------- |
| Stage         | Status | Triage, Needs review, Qualified, Nurture or Disqualified                                      |
| Summary       | Text   | Readable score, computed/current outcome, findings, public source links, gaps and next action |
| Justification | Text   | Optional SDR explanation, retained verbatim                                                   |
| Metadata      | Text   | Versioned structured submitted input and protected machine output                             |

Stage is the only decision/reset control. Summary and Metadata never authorize a review, and editing Justification alone is documentation. Internal structured assessments and the operational database remain authoritative. Metadata output retains assessment/cycle IDs, classification, score, review ID/revision/status, decision source, structured evidence/gaps/reasons, next action, operation marker and applied assessment ID. Exact read-back and conflict checks cover the four projected values, including the complete Metadata text; manual reformatting can conflict.

Metadata has separate `input` and `output` objects. Before creating a Triage entry, a trusted submission may supply an optional inquiry through `input`, validated with the same strict type/date/text schema as generic intake:

```json
{
  "version": 2,
  "input": {
    "inquiry": {
      "type": "demo_request",
      "occurredAt": "2026-10-17T12:00:00Z",
      "text": "Please show our procurement team a demo."
    }
  }
}
```

Use the actual submitted date and text. Supported types are `demo_request`, `sales_contact_request` and `purchase_inquiry`; future dates and unknown properties are rejected. A manually created entry without inquiry remains uncertain about buying intent. Neither Stage nor free text in Summary/Metadata implies intent; the integration never invents a date. New entries cannot supply machine `output`. After intake, both captured input and machine output are protected by exact comparisons. To submit corrected information, complete/reconcile the current cycle and request a deliberate new cycle. Generic [CURL intake](intake.md) remains supported and does not require an Inquiry attribute.

Mappings without `layoutVersion` retain their original 21-field layout, including the original optional Inquiry and contact fields. They continue reading the legacy inquiry. Setup reuses an existing legacy mapping for the same list without converting or deleting any field. New compact lists do not need Inquiry, Contact name or Contact email attributes.

The mapping contains workspace/list/company-object UUIDs, `{id,slug}` for every attribute, the captured layout, required option/status UUID maps and limits. Setup supplies compatible defaults. Keep credentials outside it:

```dotenv
LEAD_QUALIFICATION_MODE=production
LEAD_QUALIFICATION_TOKEN=<random token with at least 32 characters>
ATTIO_API_TOKEN=<workspace token>
ATTIO_WEBHOOK_SECRET=<webhook signing secret>
```

With neither mapping nor Attio secrets, local mode remains available. Partial connected configuration fails startup. Adding Attio does not redirect generic local events.

| Limit             | Meaning                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `timeoutMs`       | HTTP deadline, 100–30000 ms; setup default 10000                                      |
| `maxAttempts`     | Persisted inbox/output attempts, 1–10; default 3                                      |
| `retryDelayMs`    | Minimum retry delay, 10–60000 ms; default 1000                                        |
| `maxRetryDelayMs` | Supported provider wait, at least the minimum and at most 3600000 ms; default 3600000 |

Numeric and HTTP-date Retry-After values are respected. A requested wait beyond the configured maximum stops visibly instead of retrying early. Authentication, validation, missing records and conflicts do not retry. Attempts and timing survive restart.

## Register the webhook

Expose the production server through HTTPS ingress with persistent `data/` storage and one application instance. Setup prints two subscription filters for `/lead-qualification/webhooks/attio`: list-entry.created for the selected list and list-entry.updated for its Stage attribute. Each uses a flat `$and` filter. Update the intended existing webhook or create one deliberately; do not register duplicate subscriptions or rotate its secret implicitly. See [Attio webhook configuration](https://docs.attio.com/rest-api/guides/webhooks).

The route verifies SHA256 HMAC over raw bytes using `Attio-Signature` or legacy `X-Attio-Signature`. It requires `Idempotency-Key`, persists the batch and individual event associations, then returns 202 before external reads or research. Database lock waiting is bounded to one second; persistence contention returns 503 for redelivery. Changed payloads under the same delivery ID are rejected. Irrelevant events are ignored by the worker.

Only this signed route is public. Generic intake, local review, run reads, Studio and built-in APIs retain production bearer authentication. A public demo uses production mode.

The communication flow is:

1. Attio sends a signed callback when an entry is created or Stage changes. Mastra stores it before acknowledging delivery; callbacks contain no authority to change the score or approve a review by themselves.
2. The existing worker reads the current Attio entry and company. For new Triage cycles it captures configuration, searches approved sources within the shared budget and stores the immutable assessment.
3. Mastra journals its intended output, compares the current CRM fields, writes the packet or automatic outcome through Attio’s API, then reads it back to verify every field and operation marker.
4. A human final Stage transition on a pending review returns through the same signed inbox. Mastra verifies the workspace member and value history, records the decision, then mirrors the outcome. No further research occurs for that decision or a manual Needs review reopen; an explicit Triage reset requests a fresh linked assessment.

Attio stores the visible working fields; Mastra’s operational database retains delivery associations, immutable assessments, human decisions, review history and output journals. Polling by the demo or verification script only observes these states and never resubmits a lead.

## Create an example profile

Add the real company to Attio first. The explicit domain must identify exactly one existing company. The CLI creates a qualification entry with Triage and the selected explicitly generated example inquiry. Compact entries carry it in Metadata.input; Faker contact values remain in the generated profile and are written only for legacy layouts:

```sh
node --env-file=.env --import tsx scripts/attio-demo.ts --domain attio.com --seed 42 --scenario recent-inquiry
```

Scenarios are `recent-inquiry`, `past-inquiry` (91 days ago) and `no-inquiry`. Contact email uses `example.com`; research uses the supplied real domain. The CLI prints entry ID, seed, current route and run ID when available. After 15 seconds it can report waiting_for_webhook. Re-running intentionally creates another entry. It does not force an outcome or create a person record.

Confirmed fit and recent intent can become Qualified; supported fit with a past inquiry can become Nurture; a confirmed exclusion becomes Disqualified. Missing or conflicting evidence becomes Needs review. Public marketing calls to action do not prove intent to buy.

## Review by moving Stage

Inspect Summary for the score, public source links, review findings and next action. New packets use plain text with headings and blank lines; internal IDs and submitted evidence references remain in the authenticated assessment. Native Text fields support multiline entry with Shift+Enter. [Attio rules apply to objects, not lists](https://attio.com/help/reference/managing-your-data/objects/create-and-manage-rules), so this list integration does not impose a native conditional justification requirement.

While a published review is awaiting_review, move **Stage** to Qualified, Nurture or Disqualified. That human transition resolves the review and publishes the conclusion in Summary and records review status Approved and decision source SDR in Metadata.output. Justification is optional and remains exactly as written; no reason is invented when it is absent. A reason longer than 2000 characters leaves the review unchanged with `attio_justification_too_long`; shorten or clear it deliberately before retrying the Stage command.

New human conclusions receive an outcome-appropriate next action labeled as the SDR conclusion. The assessment summary still describes the original computed result. Already authorized outputs retain their exact recorded text during recovery.

The adapter verifies the active Stage through [authoritative value metadata](https://docs.attio.com/rest-api/endpoint-reference/entries/list-attribute-values-for-a-list-entry). Exactly one active history value must equal the entry value, and its workspace member must match the event actor. Its timestamp must strictly follow the current publication or previous terminal output and must be no later than 5000 milliseconds after the original durable webhook receipt. Retries and delayed processing keep that original receipt as the upper-bound anchor. This application policy accepts bounded timestamp uncertainty; it is not an Attio API timing guarantee and cannot perfectly bind a callback to a particular transition within that window. System and API-token actors cannot authorize human decisions. Timestamps at or before the lower bound and beyond the upper bound remain blocked. An unresolved company identity remains blocked with `attio_identity_unresolved`; the company reference and assessment are preserved. Identity correction needs an explicit reconciliation/new cycle, not an unsupported approval.

After a cycle closes, further final Stage changes and documentation edits do not change its recorded decision, authorize another write or trigger research. They remain CRM documentation. Only these explicit transitions start more work:

- **Needs review** reopens manual review on the same run and assessment. It creates a fresh packet ID, incremented revision and new expiry. The prior state, packet, decision and authorization are archived unchanged, and prior operation journals remain readable. The existing worker advances only the output lifecycle; the completed native workflow and model work remain completed.
- **Triage** starts a new linked qualification cycle with current evidence and configuration after the previous cycle is terminal and reconciled. Active review, failed/conflicted output or uncertainty blocks re-enrollment.

At command acceptance in compact mode, only Stage and Justification may differ from the prior published/applied state. Evidence, score, assessment/cycle IDs, packet revision, operation marker and all other machine-owned fields must match. The actual command state and Stage-inclusive metadata revision are captured durably; every pending write compares that exact state. Rewriting the same value after acceptance can still conflict. Documentation edits made after closure are allowed when a later explicit command is accepted, rather than silently ignored during output writes.

Local review APIs cannot approve Attio destinations. Rejected, Changes requested and historical three-field decisions remain readable in legacy records; standalone Review status edits are no longer commands. The legacy layout also permits its existing Classification and Review status documentation changes at command acceptance.

## Inspect failures and recover

Authenticated `GET /lead-qualification/runs/<runId>` exposes business state, attempts, next retry time and safe failure code. `GET /lead-qualification/attio/deliveries/<deliveryId>` exposes inbox outcomes. Review publication uses Pending; final/closed output uses Applied. A failed API read can prevent updating CRM diagnostics, so durable local records remain authoritative.

Output intent is journaled before sending. Marker and every projected CRM field must agree on read-back. Restart reconciles a lost response before attempting another write. Changed packets, stages or cycles become conflicts. Permanent failures and exhausted uncertainty reserve the destination for operator reconciliation. Do not clear counters or operation markers to obtain a retry.

Attio uses read-then-write rather than atomic compare-and-set. Another actor can change fields after the final read and before PUT. Dedicated attributes, controlled editing and read-back reduce this risk; they do not guarantee exactly-once network delivery.

## Upgrade and roll back

Disable intake/subscription, stop the application cleanly and make a consistent backup of `data/application.db`. Copying a running SQLite file without its write-ahead log is not a consistent backup. Follow the separate [observability storage policy](operations.md).

Startup adds inbox/outcome tables and cycle/output metadata columns. Manual reopen adds `lead_review_history`; archived JSON is copied directly before the current-cycle pointer switches in the same transaction. Revision 1 retains its original operation IDs; subsequent journals use names such as `<runId>:review:2` and `<runId>:final:2`. No assessment is copied or regenerated for manual review.

New legacy-layout patches capture presentation version 1; compact patches capture version 2 before authorization. Absence retains the exact original projection. Packets, operations and authorized digests are immutable, and recovery never silently reprojects them into a different layout.

Keep an existing legacy deployment and mapping while its reviews, inbox or operations are active. Setup refuses mapping replacement during that work and preserves the old mapping when reusing its list. A compact cutover requires an explicit new-list/mapping choice with intake stopped, reconciled output and a consistent application/database/mapping backup. Completed legacy entries still require their original mapping/runtime for future Needs review or Triage commands; draining active work does not migrate their history. Preserve that deployment or handle its migration separately before retiring it. Do not point a compact mapping at old authorized journals. Setup never deletes CRM attributes or records, rewrites old operations, or converts existing rows.

Restore a matching application/database backup together for rollback, retaining the newer database for reconciliation. Restoring an older snapshot can discard accepted deliveries. Reverting code does not undo CRM writes, delete demo rows or restore Attio stages. Reconcile markers before enabling intake; deletion and live repairs have separate scope.

## Optional sales handoff and outcomes

An Attio Workflow can react to Qualified and find an existing sales destination. For a company sales list, use Find list entries and Add record to list. For Deals, find the related deal or create one with an explicit unique handoff key. Preserve assessment/cycle correlation and avoid resetting advanced sales stages on requalification. Test repeated and concurrent events before enabling the automation; find-then-create alone is not atomic. Setup does not provision it.

Optional `sales` mapping contains a separate listId, `{id,slug}` attributes stage/assessmentId/cycleId, and wonOptionId/lostOptionId. Correlation text UUIDs must reference an applied qualification. Authoritative outcomes are deduplicated without research. Add the corresponding separate sales-stage subscription explicitly. Without mapping, conversion is unavailable; aggregate reporting is a separate extension.

## Verify the paths

```sh
npm test -- tests/integration/attio.test.ts
```

The integration suite also covers setup planning, compatible reuse, interrupted apply, conflicting attributes, pending-work protection and secretless mapping replacement using fixture HTTP only.

The separate live source is `tests/live/attio.test.ts` and `vitest.attio-live.config.ts`. Keep live-test choices outside `.env`. Create a private JSON configuration file outside the template with `baseUrl` (the HTTPS deployment), `cases` (three `{domain, scenario, expected}` objects, exactly one per Qualified/Nurture/Disqualified) and `reviewRunId` (an existing completed Stage-approved Attio review manually reopened from a closed round). Pass its absolute path only for the invocation: `ATTIO_LIVE_CONFIG_FILE=/absolute/private/attio-live.json node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.attio-live.config.ts`. Actual API credentials remain runtime environment variables. Missing/invalid configuration fails before creating any entry. Before creating entries, the proof re-reads its run and current destination, verifies the current human Stage decision, manual-reopen metadata, archived authorization/decision bindings, final fields and unchanged original assessment and score. A legacy three-field human decision alone is insufficient for this protocol; it remains valid archived evidence when present. It does not perform new research for that historical case or replace evidence from any previous failed run.

Authorize three new entries, one human-requested requalification and their bounded research separately. Each case creates once and keeps its original expectation; a mismatch is recorded and remaining cases continue. As soon as an Applied Disqualified entry is available, the proof requests one explicit human move to Triage and continues the other automatic cases. After the initial cases, it waits up to 600 seconds for the linked cycle, within an absolute 1740-second deadline and 1800-second test timeout. It verifies the predecessor, fresh assessment, current configuration and immutable original assessments; the new result may remain Disqualified. Missing prerequisites or missing branches fail, and fixture success does not prove live success.

CLI and live polling retry only retryable entry reads and protected run-status reads, bounded by the configured consecutive-attempt limit, Retry-After, maximum retry delay and observation deadline. They never repeat entry creation or research. The CLI reports the existing entry/run and an observation error when polling cannot finish; inspect that entry before considering another submission. Aggregate live failure remains failure.

Customization prompt:

> Adapt this integration to [dedicated company list]. Inspect shared field definitions, setup discovery, provider projection, authoritative review and output journals. Preserve Stage-driven decisions, optional justification, documentation-only edits and manual review history, exact captured post-decision state, actor/time checks, signed durable intake and bounded retries. Add fixture coverage for ambiguous setup resources, changed packets, delayed callbacks, same-value edits before a pending write, manual reopen after a completed workflow, restart and linked requalification. Keep secrets outside the mapping and require explicit scope before any live resource changes or research.

## Driver selection

Production defaults to Attio input/output; local defaults to JSON input and local text/Markdown output. Mapping files and credentials alone do not activate Attio in local mode. Pass an explicit configuration to `createApplicationRuntime` to select its input and output independently. Attio input requires the webhook signing secret, creates only its existing inbox tables and installs only its signed transport routes. JSON input with Attio output requires mapping/token but no webhook signing secret and installs no webhook. Attio input with local output supports initial local cycles; native Stage review/reopen/requalification commands require Attio output. See [driver composition](crm-adapters.md).

The concrete input, output, client, presentation, metadata, routes and inbox implementation are under `src/mastra/providers/attio/`. The generic workflow, admission service and dispatcher use common contracts. Existing `attio-stage` decisions, reviewer workspace/member data, table names, signed delivery acknowledgements, active mappings and authorized legacy/compact projections are preserved.

For JSON lead intake with complete native Attio review, explicitly add `additionalInputs: ['attio']` alongside the generic/Attio selection and supply the signing secret. This starts the full signed Attio input, including its durable command processing and admission of relevant new list entries. Without this additional input, Attio output can apply automatic results, but uncertain packets have no native Stage command listener. No extra transport or secret is enabled implicitly. Additional inputs must provide their own custom transport; input IDs and source IDs remain distinct.
