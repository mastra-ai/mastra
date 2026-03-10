# Plaid Finance Tool

This example shows a Mastra agent using Plaid sandbox tools to create a sandbox session handle, fetch account balances, and review transaction history.

## Prerequisites

- Node.js 22+
- `pnpm`
- An OpenAI API key
- Plaid sandbox credentials

## Get Plaid Sandbox Keys

1. Create a free Plaid account at [dashboard.plaid.com](https://dashboard.plaid.com/).
2. Open the Plaid dashboard and create an app if you do not already have one.
3. Copy your sandbox `client_id` and `secret`.
4. Copy `.env.example` to `.env` and fill in:

```bash
PLAID_CLIENT_ID=your_client_id_from_dashboard.plaid.com
PLAID_SECRET=your_sandbox_secret_from_dashboard.plaid.com
OPENAI_API_KEY=your_openai_api_key
```

## Install

```bash
cd examples/plaid-finance-tool
pnpm install
```

## Run

Run the strict TypeScript build check:

```bash
pnpm build
```

Run the example entry point:

```bash
pnpm exec tsx src/index.ts
```

Run the tests:

```bash
pnpm test
```

## What It Does

- Creates a Plaid sandbox public token
- Exchanges it for a sandbox access token stored only on the server side
- Returns an opaque sandbox session handle to the agent
- Uses that handle to fetch account balances and transactions
- Exposes transaction history tooling for finance questions

## Note

This example is intentionally sandbox-only. For real bank account connections, use Plaid Link to create a `link_token`, collect a `public_token` from the client, and exchange that token server-side.
