---
'@mastra/stagehand': patch
---

Added a `STAGEHAND_MODEL_PROVIDERS` export listing the model providers Stagehand can resolve, so callers can validate a model before starting a browser:

```ts
import { STAGEHAND_MODEL_PROVIDERS } from '@mastra/stagehand';

const [provider] = 'anthropic/claude-sonnet-4-5'.split('/');
const supported = STAGEHAND_MODEL_PROVIDERS.includes(provider);
```
