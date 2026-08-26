---
'@mastra/fastembed': minor
---

Added multilingual embedding support to FastEmbed. The multilingual E5 Large model is now available as two role-specific embedding models: use `multilingualE5LargePassage` for text you index and `multilingualE5LargeQuery` for search text. Both produce 1024-dimensional vectors, so your vector index must be created with matching dimensions.

```typescript
import { Memory } from '@mastra/memory';
import { fastembed } from '@mastra/fastembed';

const memory = new Memory({
  embedder: fastembed.multilingualE5LargePassage,
});
```
