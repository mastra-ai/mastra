# TWZRD Agent Intel Example

Demonstrates using [TWZRD Agent Intel](https://intel.twzrd.xyz) as a remote MCP server
within Mastra agents for trust verification of Solana agent wallets.

## What it does

1. Connects to the TWZRD remote MCP server (`https://intel.twzrd.xyz/mcp`)
2. Lists available trust scoring tools
3. Scores a Solana agent wallet (returns 0-100 trust score)
4. Runs a preflight check before transacting

## Setup

```bash
npm install
```

No API key needed for TWZRD trust scoring tools.

For the Mastra agent part, set your Anthropic API key:

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

## Run

```bash
npm start
```

## MCP Config

```json
{"mcpServers": {"twzrd-agent-intel": {"url": "https://intel.twzrd.xyz/mcp"}}}
```

## Available Tools

| Tool | Description | Cost |
|------|-------------|------|
| `score_agent(wallet)` | Trust score (0-100) + reputation | Free |
| `resolve_agent(wallet)` | Agent identity resolution | Free |
| `preflight_check(wallet)` | Pre-transaction safety check | Free |
| `verify_trust_receipt(receipt)` | Verify x402 payment receipt | Free |
| `get_trust_receipt(wallet)` | Full trust receipt | x402 |

PyPI package: `pip install twzrd-agent-intel`
