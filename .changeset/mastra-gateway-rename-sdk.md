---
'@mastra/code-sdk': minor
---

Renamed the Gateway constants exported from `@mastra/code-sdk/onboarding/settings` and added `MastraCodeGateway.getMastraGatewayApiKey()` so they match the Gateway product name. The old constant and method names keep working as deprecated aliases, and the stored values are unchanged.

```ts
// Before
import { MEMORY_GATEWAY_PROVIDER, MEMORY_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';

// After
import { MASTRA_GATEWAY_PROVIDER, MASTRA_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';
```
