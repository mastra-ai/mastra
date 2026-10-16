---
'@mastra/code-sdk': patch
---

Added `normalizeLegacyProviderId` to `@mastra/code-sdk/providers/model-ids`. It maps a provider id Mastra Code once defined itself to the catalog id models.dev uses, so a reply's provider can be matched against the catalog.

```ts
import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';

normalizeLegacyProviderId('kimi-for-coding'); // 'kimi-code-plan-cn'
normalizeLegacyProviderId('anthropic'); // 'anthropic'
```
