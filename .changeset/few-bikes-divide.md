---
'@mastra/core': patch
---

Fixed the Cloudflare Workers AI model provider configuration to use `CLOUDFLARE_API_TOKEN` for authentication instead of incorrectly reusing `CLOUDFLARE_ACCOUNT_ID`.
