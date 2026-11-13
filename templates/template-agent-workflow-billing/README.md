# Agent & Workflow Billing

Charge for Mastra agents and workflows through subscriptions, prepaid credits, per-task charges, or measured usage. Generate private images with an image agent and an approval workflow through billed actions in Mastra Studio. Start with local simulated balances, or connect Autumn for provider-owned prepaid reservations and deductions.

Start with the [provider and policy catalog setup](docs/billing.md#connect-your-own-agents-and-workflows), copy the [billed agent and workflow calls](docs/billing.md#invoke-billed-resources), or configure [Autumn customer bindings and the bundled image catalog](docs/autumn.md#configuration).

## Why we built this

Structuring payment logic for agents and workflows takes more than adding a checkout. You need to decide who pays, when to reserve credits, and how to handle retries, failures, and workflows that pause for approval. Few examples show how to connect these pieces specifically to agents and workflows.

We built this template to provide a straightforward starting point for billing in Mastra, with configurable charging policies and an Autumn integration you can adapt to your own product.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the image agent and its OpenAI image tool. Account access to the fixed `gpt-image-2.5-flare` image profile is required. Model usage is billed to your OpenAI account.
- Local mode needs no payment credentials. Keep `BILLING_MODE=local` and `BILLING_PROVIDER=local`. OpenAI generation is billed separately to the operator.
- Set `BILLING_STUDIO_ENABLED=true` to enable native Studio Assistant text chat and the billing tools. Authentication uses an `Authorization` header; local setup creates the credential and workspace ID used below.
- Optional **[Autumn credentials](https://app.useautumn.com)**: configure `AUTUMN_SECRET_KEY`, trusted customer/feature bindings, JWT identity, and `BILLING_CONFIG_FILE` as described in the [Autumn guide](docs/autumn.md). Local setup does not need Autumn credentials.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest billing-images --template agent-workflow-billing`.
   - Run `cd billing-images`, then `npm install`.
2. **Configure the local Studio demo**
   - Run `cp .env.example .env`, add `OPENAI_API_KEY`, and set `BILLING_STUDIO_ENABLED=true` as described under Prerequisites.
3. **Prepare local billing**
   - Run `npm run setup` to create John, Emma, and Alex with separate personal organizations. A fresh account starts with 30 simulated image credits. Existing profiles, credentials and spent balances are preserved.
4. **Open Mastra Studio**
   - Run `npm run dev`, then open [Studio Tools](http://127.0.0.1:4111/tools).
   - In **Settings → Mastra Connection → Headers**, add `Authorization` with value `Bearer <credential>`, replacing `<credential>` with `profiles.owner.credential` from the private `data/local-profiles.json`. Select **Save configuration** and return to **Tools**. Keep credentials out of recordings.
5. **Run the image agent through billing**
   - Open **billing-image-generate → Playground → JSON** and paste the input below. Replace `OWNER_WORKSPACE_ID` with `profiles.owner.workspaceId` from the same file.
   - First run **billing-account** with the same `workspaceId` and note its current balance B. Then run the image tool. Expect a private image reference in `result.object.artifacts` and a receipt with `billing.billedUnits: 1` and `billing.executionStatus: "completed"`. A tool result containing `error` means the action failed, even if Studio shows a successful HTTP request.

```json
{
  "workspaceId": "OWNER_WORKSPACE_ID",
  "idempotencyKey": "first-image",
  "brief": "A small blue bird in a quiet forest, flat illustration"
}
```

Open **Agents → Studio Assistant** for persistent text chat with the same billed image and workflow operations. Ask “Generate one private illustration of a blue bird in a quiet forest.” Ordinary conversation costs no credits; business tool results carry the actual receipt. Native approval/decline controls review a saved kit. Stop ends the conversation activity, while explicit business cancellation uses the workflow cancel tool. **Tools → Playground** remains available. The [image guide](docs/images.md) covers protected image downloads, and the [Studio guide](docs/studio.md) lists tool inputs. Local mode simulates billing in your local database.

## Try it out

- Reopen a saved **Studio Assistant** conversation and ask it to query the previous `operationId`. If Stop hid the initial result, ask it to query saved operations without an ID. History and structured tool results persist; querying existing work does not regenerate an image.
- Read **billing-account** before a new image and call its observed balance **B**. One successful image leaves **B − 1**; the full kit then leaves **B − 4**. A fresh local account starts at 30, so these values are 29 and 26. Existing accounts start at their current balance; setup never refills them.
- Run **billing-image-generate** again with the exact same input and key. The receipt sets `replayed: true` and keeps its original `billedUnits: 1`, without another charge. Change the key for a new image.
- John uses `profiles.owner`; Emma uses `profiles.member`; Alex uses `profiles.outsider`. Switch to Emma's credential in **Settings → Mastra Connection → Headers** and use her own `workspaceId` for an independent balance. John's workspace denies her access until John explicitly converts it to shared and invites her.
- Open **billing-image-kit-start** and use the brief input with a new key, such as `first-kit`. The workflow holds three credits without a confirmed charge and saves three prompts for the same subject as book and website illustrations, in order: Notion-inspired, 3D, and vector illustration. Review `result.pending.approval.prompts` before generating images. Copy `result.executionId` into **billing-image-kit-approve**, together with the same `workspaceId`, a new `idempotencyKey`, and `"approval": {"approved": true}`. Successful completion produces three private artifacts and confirms one three-credit parent charge. Use **billing-image-kit-status** with `workspaceId` and `executionId` to inspect your kit, including after restarting the server. For a suspended kit, use **billing-image-kit-cancel** with those fields and a new `idempotencyKey` to release its reservation without charging. Other members cannot read or resume your kit.

## Customization

- Open the project in your coding agent and ask: “Add a product illustration use case, keeping shared workspace billing and charging only for successful work. Explore the code and propose a plan before making changes.”
- Configure the provider, `credits` meter, plans and per-resource policies in [src/mastra/index.ts](src/mastra/index.ts). Register ordinary agents/workflows directly, or opt into billing with `billing.agent(...)` and `billing.workflow(...)`. Keep your own Mastra options in its normal constructor. See the [billing guide](docs/billing.md).

The image agent and kit are examples; the application bootstrap and billing integration are generic. Native agents and workflows live under `src/mastra/agents` and `src/mastra/workflows`. Optional `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` and `OPENAI_IMAGE_SIZE` override the default image profile; see the [image guide](docs/images.md#configure-the-image-profile).

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
