# Agent & Workflow Billing

Turn supplied weather observations into a summary or an approved report while charging a shared workspace once for successful work. The local example includes two members sharing allowance, an outsider profile, private workflow results, and persistent approval across server restarts.

## Why we built this

Agent products need to authorize each person while charging the organization they work in. A weather summary and a report with human approval make shared credit, reservations, retries, and success-only charging easy to try through one billing gateway.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for `openai/gpt-6-luna`. Setup itself makes no model calls.
- Local mode needs no payment credentials or weather service. Supply observations yourself; reports describe those observations rather than fetching a forecast.
- Polar is optional and requires trusted JWT identity, commercial mappings, and billing contacts. See [billing configuration](docs/billing.md#polar).

## Quickstart 🚀

1. **Open the template**
   - In this source checkout, open `templates/template-agent-workflow-billing`.
   - Once published in the template registry, scaffold with `npx create-mastra@latest billing-weather --template agent-workflow-billing`, then `cd billing-weather`.
2. **Prepare local access**
   - Run `npm run setup`. It installs missing dependencies, copies `.env.example` to `.env` when absent, and saves private example profiles and initial allowance.
   - Fill in the key described under Prerequisites. Keep `BILLING_MODE=local` and `BILLING_PROVIDER=local` for this example.
3. **Start the gateway**
   - Run `npm run dev`. In another terminal, run the first action below. Expect a weather summary and a receipt with `billedUnits: 3`.
   - The gateway listens at `http://127.0.0.1:4111`. Studio and native execution routes are closed; use the authenticated CLI.

```sh
npm run weather -- generate --key first-weather --json '{"location":"Porto Alegre","observedAt":"2026-11-08T12:00:00Z","temperatureC":24,"feelsLikeC":26,"humidityPercent":70,"windKph":18,"precipitationChancePercent":60,"conditions":"Cloudy with showers possible"}'
```

## Try it out

- Repeat the same command and key to replay the saved result without another model call or charge. Change the key for new work.
- Run `npm run weather -- account` to inspect the shared balance. Add `--profile member` to a new generation command; its successful result spends the same workspace's allowance. Add `--profile outsider` to see rejection before computation.
- Save the observation JSON to `observations.json`, then run `npm run weather -- start --input observations.json --key report-one`. It returns a suspended execution. Restart the server, then run `npm run weather -- resume <executionId> --json '{"approved":true}' --key approve-one` to produce the final report with one task charge.
- Run `npm run weather -- status <executionId>` for your private report, or `npm run weather -- cancel <executionId> --key cancel-one` while suspended. Cancellation releases its reservation and bills zero. Other members cannot read or resume your report.
- Repeat `npm run setup` after spending allowance. Credentials, membership, remaining credit, and financial history are preserved.

## Customization

- Ask your coding agent: “Explore the code and propose a plan to replace weather summaries with maintenance advice while preserving shared organization billing, private approval, and success-only charges.”
- Change policies in `src/weather/configuration.ts`, or set `WEATHER_WORKFLOW_POLICY=tokens` to bill measured workflow tokens instead of one successful task. [Billing documentation](docs/billing.md) explains measurement limits, provider configuration, and production identity.

## Operations

Build with `npm run build`, then serve with `npm start`. Local mode remains explicit and loopback only. Keep `data/` and `.env` private and persistent. Setup refuses missing or corrupt credential state for an already provisioned identity; restore the matching private files rather than reprovisioning or resetting credit.

`npm run test:unit`, `npm run test:integration`, and `npm run test:local` verify deterministic behavior without live credentials. `npm run test:openai` explicitly opts into one bounded live weather generation using `.env`; it verifies actual usage, a local debit, and replay. A missing key fails as unverified.

## About Mastra templates

Official Mastra templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories after publication.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/weather-agent/CONTRIBUTING.md)
