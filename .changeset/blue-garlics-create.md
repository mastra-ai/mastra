---
'@mastra/ai-sdk': patch
---

Added support for AI SDK v6 response helpers while keeping the existing v5 stream path backwards compatible.

```ts
import { toAISdkStream, toAISdkV6Stream } from '@mastra/ai-sdk';

// Existing default path for AI SDK v5
const v5Stream = toAISdkStream(mastraStream, { from: 'agent' });

// Use the explicit v6 path with AI SDK v6 response helpers
const v6Stream = toAISdkV6Stream(mastraStream, { from: 'agent' });
```

`toAISdkStream` remains the default v5 export. Use `toAISdkV6Stream` when your app is typed against AI SDK v6 response helpers.
