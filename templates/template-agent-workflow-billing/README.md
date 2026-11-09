# Agent & Workflow Billing

Charge for Mastra agents and workflows through subscriptions, prepaid credits, per-task charges, or measured usage. This template shows how to integrate billing with Polar, using a simple weather agent and an approval workflow as examples. Try the billing flow locally without payment credentials, then connect Polar for purchases, subscriptions, and usage reporting.

## Why we built this

Structuring payment logic for agents and workflows takes more than adding a checkout. You need to decide who pays, when to reserve credits, and how to handle retries, failures, and workflows that pause for approval. Few examples show how to connect these pieces specifically to agents and workflows.

We built this template to provide a straightforward starting point for billing in Mastra, with configurable charging policies and a Polar integration you can adapt to your own product.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the weather agent. Model usage is billed to your OpenAI account.
- Local mode needs no payment credentials or weather service. Keep `BILLING_MODE=local` and `BILLING_PROVIDER=local`. The agent summarizes observations you supply; it does not fetch a live forecast.
- To connect Polar, follow the [billing configuration guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/docs/billing.md#polar). It covers credentials, products, identity, and billing contacts.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest billing-weather --template agent-workflow-billing`.
   - Run `cd billing-weather`, then `npm install`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the key described under Prerequisites.
3. **Prepare local billing**
   - Run `npm run setup` to create the example profiles and shared allowance: 30 credits and 10 tasks.
4. **Start the dev server**
   - Run `npm run dev`. The billing API listens at `http://127.0.0.1:4111`.
   - To use Studio, set `BILLING_STUDIO_ENABLED=true` before starting and follow the [Studio guide](docs/studio.md) to authenticate and run billed actions in **Tools**.
   - In another terminal, run the command below. Expect a weather summary and a billing receipt with `billedUnits: 3`. The CLI authenticates using the local profile created during setup.

```sh
npm run weather -- generate --key first-weather --json '{"location":"Porto Alegre","observedAt":"2026-11-08T12:00:00Z","temperatureC":24,"feelsLikeC":26,"humidityPercent":70,"windKph":18,"precipitationChancePercent":60,"conditions":"Cloudy with showers possible"}'
```

## Try it out

- Repeat the same command and key to retrieve the saved result without another model call or charge. Use a new key for new work.
- Run `npm run weather -- account` to inspect the shared balance. Add `--profile member` to a new generation command to spend the same workspace's allowance, or `--profile outsider` to see access denied before execution.
- Save the observation JSON to `observations.json`, then run `npm run weather -- start --input observations.json --key report-one`. The workflow drafts a report and pauses for approval. Run `npm run weather -- resume <executionId> --json '{"approved":true}' --key approve-one` to finish it for one task unit, even after restarting the server.
- Run `npm run weather -- status <executionId>` to inspect your report, or `npm run weather -- cancel <executionId> --key cancel-one` while it is paused. Cancellation releases reserved credit without charging. Other members cannot read or resume your report.

## Customization

- Open the project in your coding agent and ask: “Replace weather summaries with maintenance advice, keeping shared workspace billing and charging only for successful work. Explore the code and propose a plan before making changes.”
- Adjust the [billing policies](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/configuration.ts), or set `WEATHER_WORKFLOW_POLICY=tokens` to charge measured workflow tokens instead of one task. See the [billing guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/docs/billing.md) for policy options, Polar setup, and integration details.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
