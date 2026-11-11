# Agent & Workflow Billing

Charge for Mastra agents and workflows through subscriptions, prepaid credits, per-task charges, or measured usage. Run a weather agent and an approval workflow through billed actions in Mastra Studio. Start with local simulated balances, or connect Autumn for provider-owned prepaid reservations and deductions.

Autumn paid reservations and local simulation are described in the [Autumn integration guide](docs/autumn.md). It covers server bindings, bounded deadlines, pending receipts and explicit sandbox verification.

## Why we built this

Structuring payment logic for agents and workflows takes more than adding a checkout. You need to decide who pays, when to reserve credits, and how to handle retries, failures, and workflows that pause for approval. Few examples show how to connect these pieces specifically to agents and workflows.

We built this template to provide a straightforward starting point for billing in Mastra, with configurable charging policies and an Autumn integration you can adapt to your own product.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the weather agent. Model usage is billed to your OpenAI account.
- Local mode needs no payment credentials or weather service. Keep `BILLING_MODE=local` and `BILLING_PROVIDER=local`. The agent summarizes observations you supply; it does not fetch a live forecast.
- Set `BILLING_STUDIO_ENABLED=true` to enable the billing tools in Studio. Authentication uses an `Authorization` header; local setup creates the credential and workspace ID used below.
- Optional **[Autumn credentials](https://app.useautumn.com)**: configure `AUTUMN_SECRET_KEY`, trusted customer/feature bindings, JWT identity, and `BILLING_CONFIGURATION` as described in the [Autumn guide](docs/autumn.md). Local setup does not need Autumn credentials.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest billing-weather --template agent-workflow-billing`.
   - Run `cd billing-weather`, then `npm install`.
2. **Configure the local Studio demo**
   - Run `cp .env.example .env`, add `OPENAI_API_KEY`, and set `BILLING_STUDIO_ENABLED=true` as described under Prerequisites.
3. **Prepare local billing**
   - Run `npm run setup` to create John, Mary, and Alex with separate personal organizations. Each starts with 30 credits and 10 tasks.
4. **Open Mastra Studio**
   - Run `npm run dev`, then open [Studio Tools](http://127.0.0.1:4111/tools).
   - In **Settings → Headers**, add `Authorization` with value `Bearer <credential>`, replacing `<credential>` with `profiles.owner.credential` from the private `data/local-profiles.json`. Save the headers and return to **Tools**. Keep credentials out of recordings.
5. **Run the weather agent through billing**
   - Open **billing-weather-summary → Playground → JSON** and paste the input below. Replace `OWNER_WORKSPACE_ID` with `profiles.owner.workspaceId` from the same file.
   - Run the tool. Expect a weather summary in `result.text` and a receipt with `billing.billedUnits: 3` and `billing.executionStatus: "completed"`. A tool result containing `error` means the action failed, even if Studio shows a successful HTTP request.

```json
{
  "workspaceId": "OWNER_WORKSPACE_ID",
  "idempotencyKey": "first-weather",
  "observations": {
    "location": "Porto Alegre",
    "observedAt": "2026-11-09T12:00:00Z",
    "temperatureC": 24,
    "feelsLikeC": 26,
    "humidityPercent": 70,
    "windKph": 18,
    "precipitationChancePercent": 60,
    "conditions": "Cloudy with showers possible"
  }
}
```

The Studio demo runs through **Tools → Playground**. These tools call the weather agent and workflow through the billing gateway; native agent chat and native workflow execution remain closed. The [Studio guide](docs/studio.md) covers authentication and all tool inputs. Local mode simulates billing in your local database.

## Try it out

- Run **billing-account** with `{"workspaceId":"OWNER_WORKSPACE_ID"}`, replacing the placeholder with the owner's workspace ID. For a fresh local setup, the first summary leaves 27 of 30 credits. Local confirmation updates the balance immediately. Setup preserves the balance on subsequent runs.
- Run **billing-weather-summary** again with the exact same input and key. The receipt sets `replayed: true` and keeps its original `billedUnits: 3`, without another charge. Change the key for a new summary.
- John uses `profiles.owner`; Mary uses `profiles.member`; Alex uses `profiles.outsider`. Switch to Mary's credential in **Settings → Headers** and use her own `workspaceId` for an independent balance. John's workspace denies her access until John explicitly converts it to shared and invites her.
- Open **billing-weather-report-start** and use the summary input with a new key, such as `first-report`. The workflow drafts a report and pauses for approval. Copy `result.executionId` into **billing-weather-report-approve**, together with the same `workspaceId`, a new `idempotencyKey`, and `"approval": {"approved": true}`. Successful completion costs one task unit under the default local policy.
- Use **billing-weather-report-status** with `workspaceId` and `executionId` to inspect your report, including after restarting the server. For a suspended report, use **billing-weather-report-cancel** with those fields and a new `idempotencyKey` to release its reservation without charging. Other members cannot read or resume your report.

## Customization

- Open the project in your coding agent and ask: “Replace weather summaries with maintenance advice, keeping shared workspace billing and charging only for successful work. Explore the code and propose a plan before making changes.”
- Adjust the [billing policies](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/configuration.ts), or set `WEATHER_WORKFLOW_POLICY=tokens` to charge measured workflow tokens instead of one task. See the [billing guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/docs/billing.md) for policy options and integration details.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
