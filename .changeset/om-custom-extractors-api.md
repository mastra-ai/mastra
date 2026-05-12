---
"@mastra/memory": minor
"@mastra/core": patch
"@mastra/server": patch
---

Add a public `Extractor` API for Observational Memory. User-defined extractors can be configured on both `observation.extract` and `reflection.extract`, parsed with their Zod schema, persisted to `thread.metadata.mastra.om.extracted`, and delivered to `onExtracted` hooks with thread context.

```ts
import { Extractor, ObservationalMemory } from '@mastra/memory/processors';
import { z } from 'zod';

const topicExtractor = new Extractor({
  name: 'active-topic',
  instructions: 'Output JSON like {"topic":"billing","confidence":0.9}.',
  schema: z.object({
    topic: z.string(),
    confidence: z.number(),
  }),
  injectionBehaviour: 'carry-forward',
  onExtracted: ({ extracted, threadId }) => {
    console.log(threadId, extracted?.topic);
  },
});

new ObservationalMemory({
  storage,
  observation: {
    extract: [topicExtractor],
  },
  reflection: {
    extract: [topicExtractor],
  },
});
```

Built-in extractors (`thread-title`, `current-task`, `suggested-response`) remain available via `Extractor.threadTitle()`, `Extractor.currentTask()`, and `Extractor.suggestedResponse()`.
