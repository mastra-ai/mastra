# Accounts Payable Invoice Processing

Drop an invoice into Mastra Studio and let the agent do the AP work: extract the fields, validate the vendor, match the purchase order and receipt, detect duplicates, apply policy, request approval when needed, and post the bill.

The default demo uses local accounting fixtures, so you can experience the complete workflow without connecting an ERP. QuickBooks is an optional integration when you are ready to work with a sandbox or real accounting data.

## Why it is useful

Invoice extraction benefits from a multimodal model, but financial decisions should not depend on model judgment alone. This template combines a conversational Studio agent with deterministic workflow steps, durable approval pauses, provider adapters, and observability.

## Demo

Give the agent one job:

> Process the attached invoice.

It will:

1. Read the invoice and validate its printed totals.
2. Check the vendor, PO, goods receipt, sanctions result, and prior invoices.
3. Auto-post clean invoices or pause for explicit approval when policy requires it.
4. Record the decision evidence, posting result, and trace in Studio.

## Features

- PDF, PNG, and JPEG invoice intake in Studio
- Deterministic vendor, PO, receipt, duplicate, and policy controls
- Human approval with persisted suspend-and-resume state
- A credential-free local accounting demo, with optional QuickBooks adapters
- Extraction scoring and Studio observability

## Quickstart 🚀

1. Create the project:

   ```bash
   npx create-mastra@latest --template accounts-payable-invoice-processing
   cd accounts-payable-invoice-processing
   ```

2. Add your [OpenAI API key](https://platform.openai.com/api-keys):

   ```bash
   cp .env.example .env
   ```

   Add `OPENAI_API_KEY` to `.env`. The fixture accounting provider is already selected.

3. Start Studio:

   ```bash
   npm run dev
   ```

4. Open the exact URL printed by Mastra (normally [127.0.0.1:4111](http://127.0.0.1:4111)), select **Accounts Payable Agent**, attach [`assets/sample-invoice.png`](./assets/sample-invoice.png), and say:

   ```text
   Process the attached invoice.
   ```

The sample matches the included vendor, PO, and receipt fixtures and completes without QuickBooks. If a run requires approval, reply with its run ID:

```text
Approve invoice run <RUN_ID>. Comment: Reviewed in Studio.
```

QuickBooks is optional. To connect a sandbox later, see the [advanced guide](./docs/advanced.md#quickbooks-sandbox) and [live-testing checklist](./docs/quickbooks-testing.md). Posting stays off until you explicitly configure its safeguards.

## Making it yours

- Replace the fixture repositories in `src/mastra/phase2/providers` with your accounting and receiving systems.
- Adjust the approval threshold and matching policy in `src/mastra/phase2/adapters/fixture.ts`.
- Change `INVOICE_READER_MODEL` to another document-capable OpenAI model.
- Connect the agent through the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client), or invoke the workflow when invoices arrive through an inbox or document store.

Architecture, security, provider capabilities, testing commands, and deployment notes live in the [advanced guide](./docs/advanced.md).

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
