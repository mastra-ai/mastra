---
'@mastra/core': minor
---

Added `defaultModel` to subagent definitions so a subagent can run on a fully-configured model instance, not just a string model ID. Use this when the model needs provider configuration a string ID can't carry, such as a Vertex AI project, region, or credentials.

`defaultModel` takes precedence over `defaultModelId`, but an explicit model chosen at runtime (a per-invocation model or the model picker) still wins.

Before:

```typescript
const subagent = {
  id: 'explore',
  name: 'Explore',
  description: 'Read-only codebase exploration',
  instructions: 'You are an expert code explorer.',
  defaultModelId: '__GATEWAY_GOOGLE_MODEL__', // string ID only
}
```

After:

```typescript
import { createVertex } from '@ai-sdk/google-vertex'

const vertex = createVertex({ project: process.env.GCP_PROJECT_ID, location: 'us-central1' })

const subagent = {
  id: 'explore',
  name: 'Explore',
  description: 'Read-only codebase exploration',
  instructions: 'You are an expert code explorer.',
  defaultModel: vertex('__AI_SDK_GOOGLE_MODEL__'), // configured model instance
}
```
