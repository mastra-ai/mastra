# Lead Qualification

Accept domain, email, or CRM reference events and inspect their durable run associations. The current workflow records intake, protects production APIs, and recovers acknowledged work after a process restart. Research, scoring, review, and connected CRM updates are not available yet.

## Why we built this

A lead can arrive more than once or while a server is restarting. Durable intake gives developers a stable run reference before adding company research and sales decisions.

## Prerequisites

- A writable local disk for the operational and observability databases. Run one application process per data directory.
- Local mode uses loopback access without an authentication token. Set `LEAD_QUALIFICATION_MODE=production` and a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters before exposing the API through HTTPS ingress.
- Intake makes no model or CRM calls and requires no external credentials. `OPENAI_API_KEY` is reserved for research when that capability is added.

## Quickstart 🚀

1. **Install the extracted template**
   - From this template's directory, run `npm install`. Setup creates `data/` and copies `.env.example` to `.env` if it is absent.
2. **Start the development server**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
3. **Submit a lead event**
   - Send the request below. Follow its `statusUrl` to see `accepted`, then `intake_received`. The **lead-intake** workflow in Studio shows its persisted execution. Intake begins through the event API so the workflow can verify its accepted association.

```sh
curl -s http://127.0.0.1:4111/lead-qualification/events \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"type":"lead.received","eventId":"demo-domain-1","lead":{"reference":"example-company","domain":"example.com"}}'
```

## Try it out

- Resend the same event. Its `runId` stays the same, including after completion or restart.
- Replace `domain` with `email: "sales@example.com"` and use a new event and lead reference. The submitted contact stays in operational storage; it is excluded from telemetry.
- Submit `crm: {"providerId":"attio","recordId":"company-42"}` with a new event and lead reference. This records a configured reference without calling Attio or claiming the company is resolved.
- Restart the server with the same `data/` directory. Accepted pending runs resume through the dispatcher.
- Enable production mode and call an API without a bearer token. Custom intake/read routes and native Mastra workflow/agent APIs require authentication.

## Customization

- Ask your coding agent: “Explore the intake schemas, provider map, and persistence before proposing a new event input adapter. Preserve durable acknowledgement, authentication, conflict handling, and restart recovery. Add functional tests and update the intake guide.” See [extending intake](docs/intake.md).
- Change source bindings and operational limits in `src/mastra/config/intake.ts`. See [configuration](docs/configuration.md), [observability](docs/observability.md), and [operations](docs/operations.md).

## About Mastra templates

Official Mastra templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](CONTRIBUTING.md)
