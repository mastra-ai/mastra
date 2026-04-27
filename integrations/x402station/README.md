# @mastra/x402station

Pre-flight oracle tools for [x402](https://x402.org) endpoints in [Mastra](https://mastra.ai) agents.
Backed by [x402station.io](https://x402station.io) — an independent prober that scans every endpoint
on `agentic.market` (≈ 25 950 active URLs across ≈ 549 services) every 10 minutes and exposes safety
signals priced in USDC via x402 itself.

## Why agents need this

Agents that pay arbitrary x402 endpoints fall into three traps:

- **Decoys.** ≈ 161 endpoints in the network are listed at ≥ $1 000 USDC; an agent paying one loses
  its wallet. Most are anti-scraper "swarm" routes.
- **Zombies.** Services 100% erroring in the last hour but still listed in the catalog. Invisible to
  facilitator-based competitors because nobody calls them.
- **Catalog concentration.** A single provider can be > 40% of the catalog under one billing
  namespace — agents need this context before treating the network as diverse.

x402station's prober sees these because it runs naked HTTP probes — no payment required to register
a probe. This package wraps the public oracle as Mastra tools so an agent can preflight a URL before
paying.

## Installation

```bash
pnpm add @mastra/x402station
```

You'll also need a `viem`-compatible account holding USDC on Base mainnet (`eip155:8453`) or Base
Sepolia (`eip155:84532`). USDC on Base mainnet:
[`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).

## Quick start

```typescript
import { Agent } from '@mastra/core/agent';
import { createX402StationTools } from '@mastra/x402station';

const tools = createX402StationTools({
  // 0x-prefixed 64-hex private key. Or pass `account: viemAccount` instead,
  // or set X402STATION_PRIVATE_KEY in the environment.
  privateKey: process.env.AGENT_PRIVATE_KEY,
});

const agent = new Agent({
  id: 'shielded-x402-agent',
  name: 'Shielded x402 agent',
  instructions:
    'Before paying any unfamiliar x402 URL, call x402station-preflight. ' +
    'Refuse to pay when ok=false; warnings explain why.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

`createX402StationTools` returns six tools:

| Tool | Cost | Purpose |
|---|---|---|
| `x402StationPreflight` | $0.001 USDC | `{ok, warnings[], metadata}` for one URL. The fast path. |
| `x402StationForensics` | $0.001 USDC | 7-day uptime, latency p50/p90/p99, status codes, decoy probability. |
| `x402StationCatalogDecoys` | $0.005 USDC | Full known-bad list as one JSON. Cache as a blacklist. |
| `x402StationWatchSubscribe` | $0.01 USDC | 30-day watch + 100 prepaid HMAC-signed alerts on state changes. |
| `x402StationWatchStatus` | free | Status + recent alert deliveries (secret-gated). |
| `x402StationWatchUnsubscribe` | free | Deactivate a watch (secret-gated). |

Payments are auto-signed via `@x402/fetch` — every paid response includes a settled-payment receipt
that decodes the on-chain transaction hash so the agent can audit spend.

## Individual tools

```typescript
import {
  createX402StationPreflightTool,
  createX402StationForensicsTool,
} from '@mastra/x402station';

const preflight = createX402StationPreflightTool({ privateKey: process.env.AGENT_PK });
const forensics = createX402StationForensicsTool({ privateKey: process.env.AGENT_PK });
```

### Preflight

Posts the URL to `/api/v1/preflight` and returns
`{ ok, warnings[], metadata }`.

`ok` is `true` only when no critical signal fires. Critical set:

- `dead` — endpoint failing in the last hour
- `zombie` — listed but 100% erroring for the full hour
- `decoy_price_extreme` — price ≥ $1 000 USDC

Other signals (`slow`, `new_provider`, `unknown_endpoint`, …) appear in `warnings` but do not flip
`ok` to false. See [signals.md](https://github.com/sF1nX/x402station-mcp/blob/main/docs/signals.md)
for the full vocabulary.

### Forensics

Superset of preflight. Returns hourly uptime over 7 days, latency p50/p90/p99, status-code
distribution, concentration-group stats (how crowded the provider's namespace is), and a
`decoy_probability` score in `[0, 1]`.

### Catalog decoys

`{ generated_at, counts: { total, by_reason }, truncated, entries[] }`. Refreshed every ~10 min
server-side. Pull periodically and cache locally; cheaper than preflighting every URL.

### Watch subscribe / status / unsubscribe

`watch.subscribe` pays $0.01 for a 30-day watch + 100 HMAC-SHA256-signed alerts. The response
includes a 64-char hex `secret` — store it; it's the HMAC seed and is not retrievable later.

`webhookUrl` is HTTPS-only at the schema level — HMAC-signed payloads must travel encrypted.

`watch.status` and `watch.unsubscribe` are free, secret-gated. Wrong secret returns 404 (constant-
time compare; an attacker scraping IDs cannot distinguish "exists with wrong secret" from "does
not exist").

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `account` | `viem.Account` | — | Pre-built viem account for signing. |
| `privateKey` | `string` | `process.env.X402STATION_PRIVATE_KEY` | 0x-prefixed 64-hex key. Mutually exclusive with `account`. |
| `baseUrl` | `string` | `https://x402station.io` | Override base URL. Only canonical or localhost dev URLs accepted. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | Custom fetch. Mostly for tests. |
| `timeoutMs` | `number` | `30000` | Per-call timeout. Aborts the underlying fetch on hang. |

The `baseUrl` allow-list refuses anything other than `https://x402station.io` or
`http(s)://localhost` / `127.0.0.1` / `[::1]` — a misconfigured agent cannot be tricked into
signing x402 payments against an attacker-controlled host.

## Networks

Base mainnet (`eip155:8453`) and Base Sepolia (`eip155:84532`). The CDP facilitator
(`https://x402.org/facilitator`) settles payments. Mainnet requires the receiver wallet to be
funded — testnet is anonymous.

## Discovery

x402station also publishes its own discovery surfaces (`/.well-known/x402`, agent-card, OpenAPI,
MCP server-card, `llms.txt`). It scores **5/5 ("Agent-Native")** on Cloudflare's
[isitagentready.com](https://isitagentready.com/?url=https://x402station.io) scanner, with
`isCommerce=true`.

## License

Apache-2.0
