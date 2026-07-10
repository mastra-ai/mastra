---
'@mastra/core': patch
---

Add Cloudflare AI Gateway to the model router. Model strings route through Cloudflare's OpenAI-compatible endpoint, configured via `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN`. Provider API keys are managed in the Cloudflare dashboard (BYOK) or via Unified Billing.

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: 'cloudflare-ai-gateway/anthropic/claude-haiku-4-5',
});
```
