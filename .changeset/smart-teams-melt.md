---
'@mastra/langsmith': minor
---

Added vendor metadata support to LangSmith exporter. You can now dynamically route traces to different LangSmith projects and set session/tag metadata per-span using `withLangsmithMetadata`:

```typescript
import { buildTracingOptions } from '@mastra/observability';
import { withLangsmithMetadata } from '@mastra/langsmith';

const tracingOptions = buildTracingOptions(
  withLangsmithMetadata({
    projectName: 'my-project',
    tags: ['production'],
    sessionId: 'user-123',
  }),
);
```

This follows the same pattern as the Langfuse exporter's `withLangfusePrompt` helper.
