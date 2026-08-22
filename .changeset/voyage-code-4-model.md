---
'@mastra/voyageai': minor
---

Added the `voyage-code-4` code embedding model.

Use it through the pre-configured accessor or by passing the model id directly:

```typescript
import { voyage } from '@mastra/voyageai';

// Pre-configured accessor
await voyage.code4.doEmbed({ values: ['function foo() {}'] });

// Or by model id
const model = voyage.embedding('voyage-code-4');
await model.doEmbed({ values: ['function foo() {}'] });
```
