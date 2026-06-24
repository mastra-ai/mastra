---
'@mastra/voyageai': minor
---

Added support for the `voyage-context-4` contextualized chunk embedding model (preview). Each chunk is embedded with awareness of the other chunks in the same document, capturing both local detail and document-level context. Supports flexible output dimensions (256, 512, 1024, 2048).

```typescript
import { voyage, voyageContextualizedEmbedding } from '@mastra/voyageai';

// Pre-configured model
const result = await voyage.context4.doEmbed({
  values: [['Paragraph 1 from doc 1...', 'Paragraph 2 from doc 1...'], ['Content from doc 2...']],
  inputType: 'document',
});

// Or configure explicitly
const model = voyageContextualizedEmbedding({ model: 'voyage-context-4', outputDimension: 512 });
```
