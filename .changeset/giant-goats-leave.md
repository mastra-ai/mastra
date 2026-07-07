---
'@mastra/memory': minor
---

Added one-shot conversation summarization: a standalone `summarizeConversation()` function and a `Memory.summarizeThread()` method. Both distill a whole conversation with the same Observer plumbing that powers Observational Memory — without Observational Memory attached to an agent, and without writing anything back to memory. The summary and extracted values are returned to you (and to each extractor's `onExtracted` hook), so you decide where they go.

```ts
import { Extractor } from '@mastra/memory';
import { z } from 'zod';

// e.g. in an end-of-call or end-of-session hook
const result = await memory.summarizeThread({
  model: 'openai/gpt-5-mini',
  threadId,
  resourceId,
  instructions: 'Summarize this voicemail call for the business owner.',
  extract: [
    new Extractor({
      name: 'call-summary',
      instructions: 'Return a concise summary of the call.',
      schema: z.object({
        summary: z.string(),
        sentiment: z.enum(['positive', 'neutral', 'negative']),
      }),
      metadataKeyPath: false,
      onExtracted: async ({ current, threadId, resourceId }) => {
        await callRecords.upsert({ callId: threadId, callerId: resourceId, record: current });
      },
    }),
  ],
});
```

`summarizeConversation({ model, messages, instructions, extract })` takes the same options with messages you already have in hand instead of a `threadId`.

**Why:** session-based agents (for example voice calls) often need a summary or structured extraction of the finished conversation — sentiment, requested services, follow-ups — stored in the application's own database. Observational Memory's observer and extractors are built for exactly this distillation, but attaching OM to an agent just to summarize at session end forces the whole observe/activate lifecycle onto a use case that doesn't need it. These APIs expose the summarization/extraction logic directly.
