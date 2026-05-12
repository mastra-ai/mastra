---
"@mastra/memory": minor
"@mastra/core": patch
"@mastra/server": patch
---

Add a public `Extractor` API for Observational Memory. User-defined extractors can be configured on both `observation.extract` and `reflection.extract`, parsed with their Zod schema, persisted to `thread.metadata.mastra.om.extracted`, streamed as `data-om-extracted` parts, and delivered to `onExtracted` hooks with thread context plus `mainAgent`, `requestContext`, and source-specific observation payloads. The hook receives `{ previous, current }` extracted values and can return a schema-valid value to normalize what gets saved and streamed; returning `undefined` saves `extracted.current`. Observer hooks receive DB-format `observedMessages`; reflector hooks receive active and newly reflected observations without message payloads.

```ts
import { Extractor, ObservationalMemory } from '@mastra/memory/processors';
import { z } from 'zod';

const topicExtractor = new Extractor({
  name: 'active-topic',
  instructions: 'Output JSON like {"topic":"billing","confidence":0.9}.',
  schema: z.object({
    topic: z.string(),
    confidence: z.number(),
    messageCount: z.number().optional(),
    observationPreview: z.string().optional(),
    reflectedFrom: z.number().optional(),
  }),
  injectionBehaviour: 'carry-forward',
  onExtracted: ({ source, extracted, observations, mainAgent, requestContext, threadId }) => {
    console.log(threadId, extracted.current.topic, mainAgent.name, requestContext.toJSON());

    if (source === 'observer') {
      return {
        ...extracted.previous,
        ...extracted.current,
        messageCount: observations.observedMessages.length,
        observationPreview: observations.newObservations.slice(0, 120),
      };
    }

    return {
      ...extracted.previous,
      ...extracted.current,
      reflectedFrom: observations.activeObservations.length,
    };
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
