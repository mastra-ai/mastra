# Lead event intake

For a selected JSON input driver, `POST /lead-qualification/events` accepts a strict JSON object. A successful response is HTTP 202 with `runId` and `statusUrl`, after the event, effective qualification snapshot and association commit to operational storage. `GET /lead-qualification/runs/:runId` reports intake status, source and destination references, receipt/update times, a safe failure code, and telemetry availability. It omits raw input and contact email; the assessment includes attributed inquiry text when supplied as evidence.

```json
{
  "version": 1,
  "type": "lead.received",
  "eventId": "submission-1",
  "occurredAt": "2026-10-17T12:00:00Z",
  "lead": {
    "reference": "company-1",
    "domain": "example.com"
  },
  "destinationReference": "local-company-1"
}
```

`occurredAt` and `destinationReference` are optional. `lead.declaredCompanyName` is optional submitted context, not a verified legal name. `lead.inquiry` optionally records an authenticated inbound request: `{ "type": "demo_request", "occurredAt": "2026-10-17T12:00:00Z", "text": "Please show our procurement team a demo." }`. Supported types are `demo_request`, `sales_contact_request` and `purchase_inquiry`; the timestamp cannot follow receipt. The source adapter must supply genuine request provenance rather than manufacture intent from a public demo offer. Occurrence cannot follow the server's receipt time. A lead needs at least one `domain`, `email`, or `crm` reference. Additional fields are rejected. Email/domain combinations must agree after normalization. A domain is a public DNS hostname, never a URL, IP address, path, or private/local hostname. An email provides a candidate domain; qualification asks for confirmation instead of researching a guessed company. A CRM reference has `providerId` and `recordId` strings and must belong to the configured source's permitted CRM providers. No CRM API is called.

Event, lead and destination references contain 1–200 ASCII letters, digits, periods, underscores, colons, at signs or hyphens, beginning with a letter or digit. References are database values and never become file paths. Domain and email lengths are bounded by their schemas. Source ID, input adapter, and destination provider come from application configuration. `destinationReference` defaults to `lead.reference`; an incoming event cannot choose a destination provider, secret, URL or runtime mode.

## Responses and duplicate delivery

| Status | Meaning                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------- |
| 202    | Durable acceptance, or an identical delivery's existing association                                       |
| 400    | Malformed JSON, invalid schema, unconfigured CRM reference, or reused event identity with changed content |
| 401    | Missing or invalid production authentication                                                              |
| 413    | Actual body bytes or declared length exceed the configured limit                                          |
| 415    | Content type is not `application/json`                                                                    |
| 429    | Pending capacity is exhausted, or a distinct delivery targets an active destination                       |
| 503    | Operational persistence is unavailable; acceptance was not acknowledged                                   |

Delivery identity is `(configured source ID, eventId)`. Redelivery keeps the original receipt time and association and succeeds even when admission is full. A changed payload must use a new event identity. While a destination has research, human review or unreconciled output, a distinct event targeting it receives 429 without persistence. Retry later with that same new event ID. After a cycle reaches a terminal business state, a deliberate new event with `supersedesAssessmentId` referencing its latest assessment may start a new linked cycle for that destination. See [review and output](review-and-output.md). A domain is never a permanent deduplication key.

The terminal status `intake_received` means the workflow verified the association and completed its qualification step. Inspect `qualification.status` and `qualification.assessment` for sourced facts, policy snapshot, score contributions, summary and failures. Identity ambiguity completes with needs_review without research. Exhaustion/provider failure without usable material persists a failed diagnostic assessment and ends the workflow with `failed`; partial evidence remains reviewable. Historical intake-only rows have `qualification: null`. Intake status alone does not imply output or a human decision; inspect the separate `business` state. Temporary persistence errors leave work pending for reconciliation.

## Add an input adapter

Implement the documented asynchronous `EventInputProvider` in `src/mastra/providers/input.ts`. Local JSON is implemented in `providers/local/input.ts`; Attio implements the same contract in `providers/attio/input.ts`. Register an instance in `input` or a factory in `inputFactories`, with its ID in `config.source.inputProviderId`. The output provider is selected separately.

```ts
const config = { ...intakeConfig, source: { ...intakeConfig.source, inputProviderId: 'my-source' } };
const input: EventInputProvider = {
  id: 'my-source',
  source: config.source,
  transport: 'json',
  async normalize(payload, source, receivedAt) {
    const submitted = myStrictSchema.parse(payload);
    return {
      event: normalizedEventSchema.parse({
        version: 1,
        type: 'lead.received',
        eventId: submitted.id,
        sourceId: source.id,
        receivedAt,
        lead: { reference: submitted.companyId, domain: submitted.domain },
        destination: { providerId: source.destinationProviderId, reference: submitted.companyId },
      }),
    };
  },
};
const application = await createApplicationRuntime({ config, input: new Map([['my-source', input]]) });
```

The common endpoint awaits normalization and sends its result through `LeadIntake.receive`, which checks source/destination bindings, receipt time and permitted CRM references before durable acceptance. A custom transport must use that same service. For signed delivery, declare `transport: 'custom'`, provide authenticated routes and durably persist the delivery before background hydration. The generic JSON route is absent for custom transport; Attio webhook signatures cannot be bypassed through `/events`. See [driver composition](crm-adapters.md) for factory context, retries and commands.

Customization prompt:

> Add [source] through EventInputProvider and the provider maps. Inspect strict schemas, the shared admission service and trusted binding first. Normalize [source fields] asynchronously without provider branches in the workflow. Preserve genuine inquiry provenance, production authentication, streamed limits, signed durable acknowledgement when needed, changed-payload conflicts, active-destination exclusion and restart recovery. Add HTTP functional fixtures under tests/ and update this guide.
