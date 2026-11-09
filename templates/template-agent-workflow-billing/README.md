# Agent & Workflow Billing

Charge for Mastra agents and workflows through subscriptions, prepaid credits, per-task charges, or measured usage. This template shows how to integrate billing with Polar, using a simple weather agent and an approval workflow as examples. Run billed actions in Mastra Studio without payment credentials, then connect Polar for purchases, subscriptions, and usage reporting.

## Why we built this

Structuring payment logic for agents and workflows takes more than adding a checkout. You need to decide who pays, when to reserve credits, and how to handle retries, failures, and workflows that pause for approval. Few examples show how to connect these pieces specifically to agents and workflows.

We built this template to provide a straightforward starting point for billing in Mastra, with configurable charging policies and a Polar integration you can adapt to your own product.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the weather agent. Model usage is billed to your OpenAI account.
- Local mode needs no payment credentials or weather service. Keep `BILLING_MODE=local` and `BILLING_PROVIDER=local`. The agent summarizes observations you supply; it does not fetch a live forecast.
- Set `BILLING_STUDIO_ENABLED=true` to enable the billing tools in Studio. Authentication uses an `Authorization` header; local setup creates the credential and workspace ID used below.
- To connect Polar, follow the [billing configuration guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/docs/billing.md#polar). It covers credentials, products, identity, and billing contacts.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest billing-weather --template agent-workflow-billing`.
   - Run `cd billing-weather`, then `npm install`.
2. **Configure the local Studio demo**
   - Run `cp .env.example .env`, add `OPENAI_API_KEY`, and set `BILLING_STUDIO_ENABLED=true` as described under Prerequisites.
3. **Prepare local billing**
   - Run `npm run setup` to create the example profiles and shared allowance: 30 credits and 10 tasks.
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

The Studio demo runs through **Tools → Playground**. These tools call the weather agent and workflow through the billing gateway; native agent chat and native workflow execution remain closed. The [Studio guide](docs/studio.md) covers Polar authentication and all tool inputs. Local mode simulates billing and does not send usage to Polar.

## Try it out

- Run **billing-account** with `{"workspaceId":"OWNER_WORKSPACE_ID"}`, replacing the placeholder with the owner's workspace ID. For a fresh local setup, the first summary leaves 27 of 30 credits. Provider balance reflection can take about 30 seconds. Setup preserves the balance on subsequent runs.
- Run **billing-weather-summary** again with the exact same input and key. The receipt sets `replayed: true` and keeps its original `billedUnits: 3`, without another charge. Change the key for a new summary.
- In **Settings → Headers**, use `profiles.member.credential` and run a new summary against the same owner's workspace ID to spend the shared allowance. Use `profiles.outsider.credential` to see access denied. Restore the owner credential for **billing-account**, which requires billing-owner access.
- Open **billing-weather-report-start** and use the summary input with a new key, such as `first-report`. The workflow drafts a report and pauses for approval. Copy `result.executionId` into **billing-weather-report-approve**, together with the same `workspaceId`, a new `idempotencyKey`, and `"approval": {"approved": true}`. Successful completion costs one task unit under the default local policy.
- Use **billing-weather-report-status** with `workspaceId` and `executionId` to inspect your report, including after restarting the server. For a suspended report, use **billing-weather-report-cancel** with those fields and a new `idempotencyKey` to release its reservation without charging. Other members cannot read or resume your report.

## Customization

- Open the project in your coding agent and ask: “Replace weather summaries with maintenance advice, keeping shared workspace billing and charging only for successful work. Explore the code and propose a plan before making changes.”
- Adjust the [billing policies](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/src/weather/configuration.ts), or set `WEATHER_WORKFLOW_POLICY=tokens` to charge measured workflow tokens instead of one task. See the [billing guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-agent-workflow-billing/docs/billing.md) for policy options, Polar setup, and integration details.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
