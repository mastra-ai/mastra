---
'@mastra/deployer-cloudflare': patch
---

Stop writing `.env` variables to `wrangler.jsonc` to prevent secrets from leaking into source control.

- Environment variables from `.env` are no longer merged into the `vars` field of the generated wrangler config.
- User-provided `vars` from the `CloudflareDeployer` constructor are still written as before.
- A warning is logged during build with instructions to upload secrets via `npx wrangler secret bulk .env`.
