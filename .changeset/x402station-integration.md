---
'@mastra/x402station': minor
---

Add `@mastra/x402station` — pre-flight oracle tools for x402 endpoints. Six tools (`preflight`, `forensics`, `catalogDecoys`, `watchSubscribe`, `watchStatus`, `watchUnsubscribe`) wrap [x402station.io](https://x402station.io). Paid calls are auto-signed via `@x402/fetch` and settle in USDC on Base mainnet (`eip155:8453`) or Base Sepolia (`eip155:84532`). Returns `{ ok, warnings[], metadata, paymentReceipt }` so an agent can refuse to pay endpoints flagged decoy / zombie / dead. Defensive: HTTPS-only `webhookUrl`, canonical-host allow-list refuses to sign payments against any host other than `x402station.io` or localhost dev URLs, `AbortSignal.timeout(30s)` on every fetch, malformed payment receipts surface as `{ raw, malformed: true }` rather than a silent stub.
