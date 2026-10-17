# Lead event intake

`POST /lead-qualification/events` accepts a strict JSON object. A successful response is HTTP 202 with `runId` and `statusUrl`, after the event and association commit to operational storage. `GET /lead-qualification/runs/:runId` reports intake status, source and destination references, receipt/update times, a safe failure code, and telemetry availability. It omits contact details and raw input.

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

`occurredAt` and `destinationReference` are optional. Occurrence cannot follow the server's receipt time. A lead needs at least one `domain`, `email`, or `crm` reference. Additional fields are rejected. Email/domain combinations must agree after normalization. A domain is a public DNS hostname, never a URL, IP address, path, or private/local hostname. An email provides a candidate domain; intake does not resolve identity. A CRM reference has `providerId` and `recordId` strings and must belong to the configured source's permitted CRM providers. No CRM API is called.

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

Delivery identity is `(configured source ID, eventId)`. Redelivery keeps the original receipt time and association and succeeds even when admission is full. A changed payload must use a new event identity. While a destination has accepted or dispatching work, a distinct event targeting it receives 429 without persistence. Retry later with that same new event ID. After intake completes, a deliberate new event may start a new cycle for the same destination or domain. A domain is never a permanent deduplication key.

The terminal status `intake_received` means the workflow verified the accepted association. It does not represent research, qualification, or a CRM update. `failed` exposes a failed native workflow through `failureCode`. Temporary persistence errors leave work pending for reconciliation.

## Add an input adapter

Prerequisites: understand `EventInputProvider` in `src/mastra/providers/input.ts`, the schemas in `contracts.ts`, and the trusted source configuration. An input provider normalizes data; the server handles authentication and admission.

1. Define a strict input schema and normalize to `NormalizedEvent`.
2. Register the adapter by ID in `inputProviders`. Expand the configuration schema's allowed adapter IDs when adding one.
3. Bind its source, destination provider and permitted CRM references in application configuration. Do not read URLs or credentials from event data.
4. Preserve the same persistence/read contract. Add fixtures and HTTP functional tests for normalization, provenance, rejected input, duplicates and restart recovery.
5. Run unit and integration checks, then verify the configured adapter through the public event endpoint.

A minimal adapter follows the shipped interface:

```ts
const input: EventInputProvider = {
  normalize(payload, source, receivedAt) {
    const submitted = myStrictSchema.parse(payload);
    return normalizedEventSchema.parse({
      version: 1,
      type: 'lead.received',
      eventId: submitted.id,
      sourceId: source.id,
      receivedAt,
      lead: { reference: submitted.companyId, domain: submitted.domain },
      destination: { providerId: source.destinationProviderId, reference: submitted.companyId },
    });
  },
};
inputProviders.set('my-source', input);
```

Customization prompt:

> Add [source] through EventInputProvider and the provider map. Inspect the strict event contracts and trusted bindings first. Normalize [source fields] without introducing provider branches in the workflow. Keep production authentication, streamed body limits, durable acknowledgement, changed-payload conflicts, active-destination exclusion and SIGKILL/restart recovery. Add functional fixtures/tests under tests/ and update this guide. Do not add research or CRM writes to intake.
