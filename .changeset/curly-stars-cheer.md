---
'mastracode': minor
---

Configure subagent and observational-memory models with provider model instances, not just string IDs. This lets you point those models at a provider that needs configuration a string ID can't carry, such as a Vertex AI project, region, or credentials, which is what automated environments like continuous integration (CI) need.

Subagents now accept a `defaultModel` instance, and the new `observationalModel` option sets the observational-memory model (observer and reflector):

```typescript
import { createMastraCode } from 'mastracode'
import { createVertex } from '@ai-sdk/google-vertex'

const vertex = createVertex({ project: process.env.GCP_PROJECT_ID, location: 'us-central1' })

await createMastraCode({
  subagents: [
    {
      id: 'explore',
      name: 'Explore',
      description: 'Read-only codebase exploration',
      instructions: 'You are an expert code explorer.',
      defaultModel: vertex('__AI_SDK_GOOGLE_MODEL__'),
    },
  ],
  observationalModel: vertex('__AI_SDK_GOOGLE_MODEL__'),
})
```

`observationalModel` overrides the `observerModelId` and `reflectorModelId` state, so the observational-memory model can no longer be switched at runtime. To use different models for the observer and reflector, pass a custom `memory` instance instead.
