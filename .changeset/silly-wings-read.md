---
'@mastra/core': patch
---

Added `jsonPromptInjection` to the scorer `judge` config so users can opt out of native `response_format` for models that don't support it (e.g. some Groq Llama models). Previously, every scorer invocation made a wasted 400 API call before falling back to prompt injection.

```typescript
import { createScorer } from '@mastra/core/evals';

const scorer = createScorer({
  id: 'translation-quality',
  description: 'Evaluates translation quality',
  judge: {
    model: 'groq/llama-3.3-70b-versatile',
    instructions: 'You are an expert evaluator…',
    jsonPromptInjection: true, // skip the unsupported `response_format` attempt
  },
});
```

Fixes #17040.
