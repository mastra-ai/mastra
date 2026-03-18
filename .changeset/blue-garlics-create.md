---
'@mastra/ai-sdk': patch
---

Added support for AI SDK v6 response helpers while keeping the existing v5 stream path backwards compatible.

```ts
import { toAISdkStream } from '@mastra/ai-sdk';

// Existing default path for AI SDK v5
const v5Stream = toAISdkStream(mastraStream, { from: 'agent' });

// Use the v6 stream contract with AI SDK v6 response helpers
const v6Stream = toAISdkStream(mastraStream, { from: 'agent', version: 'v6' });
```

`toAISdkStream` keeps the existing v5/default behavior. Pass `version: 'v6'` when your app is typed against AI SDK v6 response helpers.
