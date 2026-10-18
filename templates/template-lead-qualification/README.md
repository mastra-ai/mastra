# Lead Qualification

A contact form, signup flow, or CRM can submit a company domain and a dated buying inquiry. The template researches approved sources, checks supporting text, and applies confirmed qualification outcomes to a local lead record. Uncertain assessments wait for a review decision with their score, evidence and reasons preserved.

The default profile is B2B SaaS with 20–500 employees, headquarters in the configured Brazil/US/European markets, and recent buying intent. Missing or conflicting facts stay visible. Local review works through Studio or the authenticated API without an Attio account; an Attio output adapter is not included.

## Why we built this

A sales development representative (SDR) identifies potential customers and qualifies their interest before handing them to sales. They need to know which company expressed interest, what supports its fit, and which facts still need confirmation. A score should explain the decision, while a restart or repeated webhook should preserve the original work.

Developers can connect their lead source while keeping provenance and qualification rules visible. A confirmed exclusion still disqualifies a company even when its remaining criteria earn points.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for GPT-6 Luna through Responses, including web search and structured extraction. Default research needs no enrichment-service or Attio account.
- Local mode uses loopback access. Set `LEAD_QUALIFICATION_MODE=production` and a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters before exposing the API through HTTPS ingress.

## Quickstart 🚀

1. **Create the project**
   - When this template is available in the catalog, run `npx create-mastra@latest lead-qualification --template template-lead-qualification`, then `cd lead-qualification`. For an already extracted template, use its directory.
   - Run `npm install`. Setup creates `data/` and copies `.env.example` to `.env` if it is absent.
2. **Add your API key**
   - Set the value in `.env` using Prerequisites. If preparing environment files manually, copy `.env.example` to `.env` first.
3. **Start the development server**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
4. **Research a company**
   - Send the request below, then GET its returned `statusUrl`. The result contains `qualification.assessment`: sourced facts, score contributions, gaps and a next action.
   - The **lead-intake** workflow in Studio shows **record-intake**, **qualify-company** and **apply-or-review**. Submit through the event API to create its durable association. Inspect `business.state` for applied output or a pending review.

```sh
curl -s http://127.0.0.1:4111/lead-qualification/events \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"type":"lead.received","eventId":"demo-domain-1","lead":{"reference":"mastra-company","domain":"mastra.ai"}}'
```

## Try it out

- Inspect a real company's assessment. Missing headcount or headquarters creates a `needs_review` packet with concrete actions. Open **Tools → reviewLead** in Studio and copy its run ID, review ID, revision and digest from the run response. Follow [local review](docs/review-and-output.md) to approve, reject or request changes.
- Add an authentic `lead.inquiry` with `type`, `occurredAt` and `text` using the [input contract](docs/intake.md). A company's own “Book a demo” page does not establish its intent to buy from you.
- Replace `domain` with an email or CRM reference and use a new event/lead reference. The result asks for a confirmed company domain and makes no research calls for the unresolved identity.
- Resend the same event or restart with the same `data/` directory. The association, captured configuration, completed research rounds and consumed allowance are preserved.
- Requalify a completed lead with a new event ID and `supersedesAssessmentId`. The new cycle uses current evidence and settings while keeping the prior assessment unchanged.

## Customization

- Ask your coding agent: “Explore the evidence contracts and policy, then propose a plan to qualify [my target market]. Preserve sourced facts, shared budgets and deterministic scoring. Add functional examples before changing the policy.” See [configuration](docs/configuration.md).
- Add an approved source domain or adapter using [research sources](docs/research-sources.md), or connect a different [input](docs/intake.md) or [output](docs/review-and-output.md). See [operations](docs/operations.md) and [observability](docs/observability.md) for recovery and storage.

## About Mastra templates

Official Mastra templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](CONTRIBUTING.md)
