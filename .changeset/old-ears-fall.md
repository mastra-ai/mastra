---
'@mastra/playground-ui': minor
---

Added `resolveModel`, which turns a model string into its provider and model plus readable names.

```ts
import { resolveModel } from '@mastra/playground-ui/utils/model';

resolveModel('anthropic/claude-sonnet-4.5');
// { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-sonnet-4.5', modelName: 'Claude Sonnet 4.5' }
```

Dated IDs read cleanly too: `claude-sonnet-4-5-20250929` becomes `Claude Sonnet 4.5` and `gpt-4o-2024-08-06` becomes `GPT-4o`. `formatModelName` and `formatProviderName` are exported on their own.
