# Lead Qualification

A contact form, signup flow, or CRM can submit a company domain, contact email, or CRM reference. The template turns each submission into a persistent lead event with a workflow run that your team can track and safely retry.

This version provides the receiving stage of qualification: it records the lead and confirms that its intake workflow completed. It does not yet research the company, calculate an ICP score, recommend a sales action, or update the CRM.

## Why we built this

A sales development representative (SDR) identifies potential customers and qualifies their interest before handing them over to the sales team. They need to know which company expressed interest, where that interest came from, and what happened to the submission before deciding how to follow up. Forms and CRM webhooks can resend events, and a server restart should not turn an acknowledged lead into missing work.

This template establishes that handoff between a lead source and a qualification workflow. Developers can adapt the input provider to their own sales process while keeping a consistent record of each lead, its origin, and its processing status. That record is the foundation for adding company research, qualification rules, and review decisions.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: `OPENAI_API_KEY` is reserved for research when that capability is added. The current intake workflow makes no model or CRM calls and requires no external credentials.
- Local mode uses loopback access without an authentication token. Set `LEAD_QUALIFICATION_MODE=production` and a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters before exposing the API through HTTPS ingress.

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
- Change source bindings and operational limits in `src/mastra/config/lead-ingestion.ts`. See [configuration](docs/configuration.md), [observability](docs/observability.md), and [operations](docs/operations.md).

## About Mastra templates

Official Mastra templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](CONTRIBUTING.md)
