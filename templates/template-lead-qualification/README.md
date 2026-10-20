# Lead Qualification

A contact form, signup flow, or CRM can submit a company domain and a dated buying inquiry. The template researches approved sources, checks supporting text, and applies confirmed qualification outcomes to a readable local report or a dedicated Attio list. Uncertain assessments wait for a review decision with their score, evidence and reasons preserved.

Qualification criteria, score weights, target markets, evidence freshness and research limits are configurable. Missing or conflicting facts stay visible. Local review works through Studio or the authenticated API without an Attio account. In connected mode, SDRs review uncertain cases inside Attio while confirmed outcomes update automatically.

## Why we built this

A sales development representative (SDR) identifies potential customers and qualifies their interest before handing them to sales. They need to know which company expressed interest, what supports its fit, and which facts still need confirmation. A score should explain the decision, while a restart or repeated webhook should preserve the original work.

Developers can connect their lead source while keeping provenance and qualification rules visible. A confirmed exclusion still disqualifies a company even when its remaining criteria earn points.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for GPT-6 Luna through Responses, including web search and structured extraction. Default research needs no enrichment-service or Attio account.
- **[Attio workspace token](https://app.attio.com/settings/developers)** (optional): connected mode requires a dedicated company list, mapped attributes/options and a webhook signing secret. Follow [Attio setup](docs/attio.md) before enabling it.
- Local mode uses loopback access. Set `LEAD_QUALIFICATION_MODE=production` and a random `LEAD_QUALIFICATION_TOKEN` of at least 32 characters before exposing the API through HTTPS ingress. Production defaults to Attio input/output; an explicit [driver configuration](docs/crm-adapters.md) can select a different pair.

## Quickstart 🚀

1. **Create the project**
   - When this template is available in the catalog, run `npx create-mastra@latest lead-qualification --template template-lead-qualification`, then `cd lead-qualification`. For an already extracted template, use its directory.
   - Run `npm install`. Setup creates `data/` and copies `.env.example` to `.env` if it is absent.
2. **Add your API key**
   - Run `cp .env.example .env` if setup has not created it, then set the value described in Prerequisites.
3. **Start the development server**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
4. **Research a company**
   - Send the request below, then GET its returned `statusUrl`. The result contains `qualification.assessment`: sourced facts, score contributions, gaps and a next action.
   - The **lead-intake** workflow in Studio shows **record-intake**, **qualify-company** and **apply-or-review**. Submit through the event API to create its durable association. Inspect `business.state` for applied output or a pending review. Open `/lead-qualification/runs/<runId>/output` for the local Markdown report, or append `?format=text` for plain text.

```sh
curl -s http://127.0.0.1:4111/lead-qualification/events \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"type":"lead.received","eventId":"demo-domain-1","lead":{"reference":"mastra-company","domain":"mastra.ai"}}'
```

## Try it out

- Inspect a real company's assessment. Missing headcount or headquarters creates a `needs_review` packet with concrete actions. Open **Tools → reviewLead** in Studio and copy its run ID, review ID, revision and digest from the run response. Follow [local review](docs/review-and-output.md) to approve, reject or request changes.
- Add an authentic `lead.inquiry` with `type`, `occurredAt` and `text` using the [input contract](docs/intake.md). A company's own “Book a demo” page does not establish its intent to buy from you.
- Connect the dedicated [Attio pipeline](docs/attio.md), generate its JSON mapping with the setup CLI, create an example profile for an explicit real domain, and review the readable findings. Move Stage to Qualified, Nurture or Disqualified to resolve a review; Justification is optional. Move a closed lead to Needs review for manual review or Triage for fresh research.
- Resend the same event or restart with the same `data/` directory. The association, captured configuration, completed research rounds and consumed allowance are preserved.
- Requalify a completed lead with a new event ID and `supersedesAssessmentId`. The new cycle uses current evidence and settings while keeping the prior assessment unchanged.

## Customization

- Ask your coding agent: “Explore the evidence contracts and policy, then propose a plan to qualify [my target market]. Preserve sourced facts, shared budgets and deterministic scoring. Add functional examples before changing the policy.” See [configuration](docs/configuration.md).
- Add an approved source domain or adapter using [research sources](docs/research-sources.md), configure [Attio](docs/attio.md), or connect a different [CRM or lead source](docs/crm-adapters.md). See [operations](docs/operations.md), [observability](docs/observability.md), [evaluation](docs/evaluation.md) and [retention](docs/retention.md) for recovery, measurement and previewed maintenance.

## Measure and maintain

Use the bounded authenticated JSON [report](docs/observability.md#query-retained-business-results) to inspect retained enrichment, qualification, review and separately observed sales outcomes. [Evaluate frozen profiles](docs/evaluation.md) before claiming quality, and preview [retention](docs/retention.md) with the service stopped before removing eligible local details.

## About Mastra templates

Official Mastra templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](CONTRIBUTING.md)
