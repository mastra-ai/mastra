# Sentinel — Internal Audit Agent

An agent that connects to NYC public spending data for audit analysis. Built with Mastra's Agent Builder.

## Data Sources

- **NYC Checkbook** — 46M+ vendor payment transactions (FY2010–FY2024)
- **SAM.gov** — Federal vendor registry, exclusion/debarment status
- **USAspending.gov** — Federal award recipient profiles
- **Local computation** — Z-score outlier detection, payment pattern flags

## Setup

```bash
cd examples/sentinel
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
pnpm install --ignore-workspace
pnpm mastra:dev
```

Open http://localhost:4111 in your browser.

## Building the Agent

In the Agent Builder UI, paste this prompt:

> Build an agent called Sentinel for internal audit support. It connects to these data sources:
>
> 1. NYC Checkbook (checkbook spending, vendor summary, and spending trend tools) — the city's official spending ledger. Contains every vendor payment, contract payment, and check issued by every NYC agency from FY2010 through FY2024. 46 million+ transaction records with vendor name, amount, agency, date, contract ID, and MWBE status.
>
> 2. SAM.gov federal entity registry (entity search and exclusion check tools) — the federal government's vendor registration system. Contains business registration status, UEI, CAGE code, entity type, physical address, and whether a vendor is debarred, suspended, or excluded from federal contracts.
>
> 3. USAspending.gov (federal recipient profile tool) — the federal spending database. Contains every federal award (grants, contracts, loans) with recipient name, total awards received, award type breakdown, and parent/child organization relationships.
>
> 4. Statistical analysis (z-score outliers and pattern flags tools) — local computation tools. Z-score analysis identifies statistical outliers in any numeric series. Pattern flags scan payment lists for audit red flags: round-dollar amounts, split payments just below approval thresholds, end-of-period bunching near fiscal year close, and duplicate amounts to the same vendor.
>
> The agent should respond concisely with bullet points and tables. No long paragraphs. When producing a risk assessment, end with a summary table scoring each risk dimension 0-100.

Select all 8 tools and click Continue.

## Demo Queries

**Spending trends (15 years):**
> Show me the Department of Homeless Services spending trend from FY2010 through FY2024 — total contract spending and vendor count per year. Then flag any vendors that received over $500K in FY2024 but had zero payments from DHS in FY2023. Be concise — bullet points and tables only, no prose.

**Fraud detection:**
> Which vendors received the most contract payments between $20,000 and $24,999 from the Department of Homeless Services in FY2024? Give me the top 10 by frequency. Then run those payments through a pattern flag analysis — check for round-dollar amounts, end-of-period bunching near June 30, and duplicate amounts to the same vendor.

**Vendor risk profile:**
> Build a risk profile for BLACK WIDOW TERMITE PEST CONTROL CORP. Be concise — use short bullet points, not paragraphs. No explanations of methodology.
> 1. Pull their FY2024 Checkbook NYC payment summary — total, count, agency breakdown.
> 2. Check SAM.gov — registration status, exclusions, registration age, address.
> 3. Look up federal award history on USAspending.gov.
> 4. Pull FY2024 transactions to check for sub-vendor relationships and round-dollar payments.
> End with a single summary table: one row per risk dimension (payment concentration, SAM.gov flags, federal history, sub-vendor complexity, payment anomalies), a score 0-100 for each, and a composite score. Nothing after the table.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for the agent model |
| `SAM_GOV_API_KEY` | No | SAM.gov API key for vendor lookups (free at sam.gov) |
| `DB_URL` | No | Database URL (defaults to `file:local.db`) |
