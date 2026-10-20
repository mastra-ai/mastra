# Lead Qualification

A Mastra workflow triages and qualifies leads received through a JSON API or Attio CRM. It researches each company, compares the findings with your sales team's ideal customer profile (ICP), and produces a score and qualification outcome with supporting sources. Results go to a local report or Attio; uncertain cases go to human review.

## Why we built this

Sales teams need to know whether incoming leads match their ICP. Manually researching every company and checking it against the qualification criteria is tedious, so we built this template to automate the initial research and triage.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1792497564/Lead_Qualification_wojntc.mp4"></video>

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default GPT-6 Luna research provider, which searches company sources and checks extracted facts.
- **[Attio workspace token](https://app.attio.com/settings/developers)**: optional. Set `ATTIO_API_TOKEN` and generate the list mapping to use Attio output. Attio input also requires `ATTIO_WEBHOOK_SECRET`. See [Attio configuration](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/attio.md).

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest lead-qualification --template lead-qualification`, then `cd lead-qualification` and `npm install`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the key described under Prerequisites. Both providers default to `local`.
3. **Start the server**
   - Run `npm run dev` and open [Mastra Studio](http://localhost:4111).
   - Submit the request below, then open the returned `statusUrl` to read the assessment and `business.state`. Inspect the run under **Workflows → lead-intake** in Studio. The result explains the company's fit and flags facts that need review.

```bash
curl http://localhost:4111/lead-qualification/events \
  -H 'Content-Type: application/json' \
  -d '{"version":1,"type":"lead.received","eventId":"company-1","lead":{"reference":"mastra","domain":"mastra.ai"}}'
```

## Try it out

- Add a genuine `lead.inquiry` using the [input contract](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/intake.md). Its date and request type contribute to buying intent; a company's own demo offer doesn't.
- For an uncertain result, open **Tools → reviewLead** in Studio and copy the current packet's references from the run response. [Approve, reject, or request changes](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/review-and-output.md), then read `/lead-qualification/runs/<runId>/output` for the local Markdown report.
- Select [Attio input and output](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/attio.md) to qualify new Triage entries and review uncertain cases by moving Stage.
- Resend an event with the same ID to retrieve its existing run. To research a completed lead again, submit a new ID and its latest `supersedesAssessmentId`.

## Customization

- Ask your coding agent: “Explore the code and propose a plan to qualify companies for my target market. Adjust the criteria, score weights, and review policy while preserving sourced evidence.” Start with [qualification configuration](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/configuration.md).
- Choose separate [input and output providers](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/crm-adapters.md), add a [research source](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/research-sources.md), or adapt [reports and telemetry](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/observability.md). [Operations](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/docs/operations.md) covers deployment and recovery.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-lead-qualification/CONTRIBUTING.md)
