---
'@mastra/voyageai': patch
---

Added support for the `voyage-code-4` code embedding model. It defaults to 1024 dimensions and also supports 256, 512 and 2048.

```typescript
import { createVoyageTextEmbedding } from '@mastra/voyageai';

const embedder = createVoyageTextEmbedding({ model: 'voyage-code-4', inputType: 'document' });
```
