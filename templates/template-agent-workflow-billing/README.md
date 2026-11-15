# Agent & Workflow Billing

Add billing to Mastra agents and workflows with configurable policies for credits, per-task charges, measured usage, and subscription access. Each billed request identifies its payer, checks access, and records execution and settlement. Prepaid operations reserve credits before work and confirm the charge after success, including workflows that pause for approval. Start with local simulated balances or connect Autumn for provider-managed credits.

## Why we built this

Structuring payment logic for agents and workflows takes more than adding a checkout. You need to decide who pays, when to reserve credits, and how to handle retries, failures, and workflows that pause for approval. Few examples show how to connect these pieces specifically to agents and workflows.

We built this template to provide a starting point for billing in Mastra, with charging policies and provider integration configured independently of your agents and workflows. Nested agent calls share their parent workflow's budget, and repeated requests with the same idempotency key reuse saved results without another charge.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the bundled Image Assistant and Image Generation examples.
- Set `BILLING_STUDIO_ENABLED=true` to enable the Image Assistant. Local setup creates the credential used to authenticate in Studio.
- Optional **[Autumn credentials](https://app.useautumn.com)**: configure `AUTUMN_SECRET_KEY`, trusted customer/feature bindings, and JWT identity as described in the [Autumn guide](docs/autumn.md). The default local provider needs no Autumn credentials.

For the **Autumn sandbox experience in production mode**, follow the [Autumn integration guide](docs/autumn.md#test-autumn-sandbox-in-studio) instead of the local quickstart below. It covers account, plan and credit setup, JWT provisioning and renewal, and testing in Studio. `BILLING_MODE=production` enables verified JWT identity; the Autumn sandbox key keeps billing in sandbox.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest billing-demo --template agent-workflow-billing`.
   - Run `cd billing-demo`, then `npm install`.
2. **Configure Studio**
   - Run `cp .env.example .env`, add `OPENAI_API_KEY`, and set `BILLING_STUDIO_ENABLED=true` as described under Prerequisites.
3. **Prepare local billing**
   - Run `npm run setup` to create John, Emma, and Alex with separate personal organizations. Each new account starts with 30 simulated credits. Existing profiles, credentials, and spent balances are preserved.
4. **Connect to Mastra Studio**
   - Run `npm run dev`, then open [Mastra Studio](http://127.0.0.1:4111).
   - In **Settings → Mastra Connection → Headers**, add `Authorization` with value `Bearer <credential>`, replacing `<credential>` with `profiles.owner.credential` from the private `data/local-profiles.json`. Select **Save configuration**.
5. **Test billing in chat**
   - Open **Agents → Image Assistant** and follow the example under **Try it out**. Studio resolves John's personal workspace from his credential.

## Try it out

Image generation is a sample use case for testing billing. The template includes one paid agent, **Image Generation**, which generates one image for 1 credit, and one paid workflow, **Image Kit**, which generates three images for 3 credits after approval. The **Image Assistant** exposes both through chat; conversation itself costs no billing credits.

- Ask: “Generate one private illustration of a blue bird in a quiet forest.” Inspect the tool result for a private artifact reference and a receipt with `billedUnits: 1` and `executionStatus: "completed"`.
- In the same conversation, ask: “Create a three-style illustration kit of the same blue bird.” The workflow reserves 3 credits and saves prompts in Notion-inspired, 3D, and vector illustration styles. Review the prompts and select **Approve**. Complete success produces three private artifacts and confirms one 3-credit charge; the nested image-agent calls have no separate charge. Select **Decline** to cancel and release the reservation instead.
- Reopen the saved conversation and ask: “Query my saved image and kit operations.” The assistant retrieves their status and receipts without generating again. A new generation request creates new paid work. **Stop** ends conversation activity; to cancel business work, explicitly ask the assistant to cancel the workflow.

Generated PNGs are stored privately in `data/private-images/` under the project root; metadata and ownership live in the billing database. Results include authenticated `downloadPath` links. Use `npm run images -- download ARTIFACT_ID bird.png` to save a file, or follow the [Studio download instructions](docs/studio.md#download-results). Keep the image directory and billing/workflow databases together when moving state.

## Customization

- Open the project in your coding agent and ask: “Replace the image examples with a paid research agent and an approval-based report workflow. Keep configurable credit policies and charge only for successful work. Explore the code and propose a plan before making changes.”
- Configure providers, meters, plans, and per-resource policies in [src/mastra/index.ts](src/mastra/index.ts). Opt into billing with `billing.agent(...)` and `billing.workflow(...)`, and keep other resources in the normal Mastra constructor. Follow the billing guide to [connect your own agents and workflows](docs/billing.md#configure-the-application) and [invoke billed resources](docs/billing.md#invoke-billed-resources), or the [Autumn guide](docs/autumn.md#configuration) to bind provider customers and credits. The [Studio guide](docs/studio.md#compose-your-own-conversation-agent) shows how to expose your resources through a conversation agent.

## Documentation

- [Billing guide](docs/billing.md): policies, subscription-only access and external API calls.
- [Studio guide](docs/studio.md): authenticated chat, approval, downloads and denial tests.
- [Autumn guide](docs/autumn.md): sandbox setup, real identities and provider bindings.
- [Architecture reference](docs/architecture.md): execution boundaries, compatibility, platform support and every billing module.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
