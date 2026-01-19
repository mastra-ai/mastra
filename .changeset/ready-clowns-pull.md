---
'@mastra/ai-sdk': patch
---

Adds `withMastra()` for wrapping AI SDK models with Mastra processors and memory.

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';

const model = withMastra(openai('gpt-4o'), {
  inputProcessors: [myGuardProcessor],
  outputProcessors: [myLoggingProcessor],
  memory: {
    storage,
    threadId: 'thread-123',
    resourceId: 'user-123',
    lastMessages: 10,
  },
});

const { text } = await generateText({ model, prompt: 'Hello!' });
```

Works with `generateText`, `streamText`, `generateObject`, and `streamObject`.
