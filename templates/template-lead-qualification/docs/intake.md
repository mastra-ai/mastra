# Lead intake

The local input accepts JSON at `POST /lead-qualification/events`. The provider and source are selected by configuration, rather than by the request.

```json
{
  "version": 1,
  "type": "lead.received",
  "eventId": "submission-1",
  "lead": {
    "reference": "company-1",
    "domain": "example.com"
  },
  "destinationReference": "company-1"
}
```

A lead needs a public company `domain`, an `email`, or a `crm` reference (`providerId` and `recordId`). Email and CRM references without a resolved domain require identity confirmation before research. If domain and email are both present, their domains must agree. Optional `declaredCompanyName` is submitted context.

`destinationReference` defaults to `lead.reference`. For Attio output, use the existing entry UUID. References are bounded identifiers, not paths or URLs. Unknown fields are rejected. See `src/mastra/contracts.ts` for the complete schemas.

## Include a buying inquiry

Add `lead.inquiry` only for a genuine inbound request. Use `demo_request`, `sales_contact_request`, or `purchase_inquiry`, a timestamp no later than receipt, and the submitted text:

```json
{
  "type": "demo_request",
  "occurredAt": "2026-10-19T12:00:00Z",
  "text": "Please show our procurement team a demo."
}
```

The input provider is responsible for its provenance. Public marketing calls to action don't establish buying intent.

## Read and repeat

A successful response is HTTP 202 with `runId` and `statusUrl`, after durable acceptance. Reusing the same source/event ID with identical content returns the original run. Changed content needs a new event ID. Another event targeting an active destination receives 429; retry after its work is resolved.

`GET /lead-qualification/runs/:runId` returns the assessment and `business.state`. Intake completion can coexist with a pending human review. For a fresh assessment of a completed destination, send a new event with `supersedesAssessmentId` equal to its latest terminal assessment ID. Earlier assessments and decisions remain unchanged.

Invalid input returns 400, oversized bodies 413, unsupported content type 415, capacity pressure 429, and unavailable persistence 503. Production requires bearer authentication. [Custom input drivers](crm-adapters.md) use the same admission service.
