---
'@mastra/core': minor
---

Added Mastra Gateway as a model router provider.

The Mastra Gateway enables access to multiple LLM providers through a unified endpoint at server.mastra.ai, supporting both API key and OAuth authentication flows.

**New exports:**

- `MastraGateway` — gateway provider class for routing models through the Mastra Gateway service
- `MastraGatewayConfig` — configuration type with `apiKey`, `baseUrl`, and `customFetch` options
- `GATEWAY_AUTH_HEADER` — constant for the custom gateway authentication header (`X-Memory-Gateway-Authorization`)
- `GatewayRegistry` — manages gateway-based provider discovery with atomic file caching
- `parseModelString` — utility to parse provider/model ID strings

```ts
import { MastraGateway } from '@mastra/core/llm';

const gateway = new MastraGateway({
  apiKey: process.env.MASTRA_GATEWAY_API_KEY,
});
```
