---
'@mastra/code-sdk': minor
---

Renamed the Gateway constants exported from `@mastra/code-sdk/onboarding/settings` so they match the Gateway product name. The old names keep working as deprecated aliases and the values are unchanged, so nothing breaks today.

```ts
// Before
import { MEMORY_GATEWAY_PROVIDER, MEMORY_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';

// After
import { MASTRA_GATEWAY_PROVIDER, MASTRA_GATEWAY_DEFAULT_URL } from '@mastra/code-sdk/onboarding/settings';
```
