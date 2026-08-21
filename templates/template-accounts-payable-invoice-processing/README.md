# Accounts Payable Invoice Processing

Turn an invoice into an accounts payable decision from one Mastra Studio prompt. Attach a PDF or image and the agent extracts the fields, validates the vendor, matches the purchase order and receipt, checks for duplicates, applies policy, and either posts the bill or asks for approval.

The template includes a sample invoice and local vendor, PO, receipt, and invoice-history fixtures, so the complete flow works without an ERP. QuickBooks is optional.

## Prerequisites

- Node.js >= 22.13.0
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

```bash
npm install
cp .env.example .env
# add OPENAI_API_KEY to .env
npm run dev
```

Open the exact URL printed by Mastra (normally [127.0.0.1:4111](http://127.0.0.1:4111)), select **Accounts Payable Agent**, attach [`assets/sample-invoice.png`](./assets/sample-invoice.png), and say:

> Process the attached invoice.

The included invoice matches the fixture data and completes without QuickBooks. If a run requires approval, the agent returns a run ID. Reply once with:

```text
Approve invoice run <RUN_ID>. Comment: Reviewed in Studio.
```

## How the agent works

1. Read the invoice and validate its printed totals.
2. Check the vendor, PO, goods receipt, sanctions result, and prior invoices.
3. Auto-post clean invoices or pause for explicit approval when policy requires it.
4. Record the decision evidence, posting result, and trace in Studio.

Invoice extraction uses a multimodal model. Vendor matching, three-way matching, duplicate detection, approval thresholds, and posting eligibility are deterministic workflow steps.

## Connecting accounting data

Optional QuickBooks connectors are included; see the [setup guide](./docs/advanced.md#quickbooks-sandbox) when you want one. You can also implement the `AccountingProvider` interface to connect your own accounting system.

## Making it yours

- Replace the fixture repositories in `src/mastra/phase2/providers` with your accounting and receiving systems.
- Adjust the approval threshold and matching policy in `src/mastra/phase2/adapters/fixture.ts`.
- Change `INVOICE_READER_MODEL` to another document-capable OpenAI model.
- Connect the agent through the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client), or invoke the workflow when invoices arrive through an inbox or document store.

Architecture, security, provider capabilities, testing commands, and deployment notes live in the [advanced guide](./docs/advanced.md).

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
