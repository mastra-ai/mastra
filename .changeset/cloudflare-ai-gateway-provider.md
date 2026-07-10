---
'@mastra/core': patch
---

Add Cloudflare AI Gateway to the model router. Model strings like `cloudflare-ai-gateway/anthropic/claude-3-5-haiku` now route through Cloudflare's OpenAI-compatible endpoint, configured via `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN`. Provider API keys are managed in the Cloudflare dashboard (BYOK) or via Unified Billing.
