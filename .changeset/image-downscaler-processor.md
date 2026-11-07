---
'@mastra/core': minor
---

Added an `ImageDownscaler` processor that shrinks oversized PNG and JPEG images before they are sent to the model. It handles both user image parts and tool-result media, such as browser screenshots. Stored messages keep the original images. Other formats pass through unchanged.

```ts
import { ImageDownscaler } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  inputProcessors: [new ImageDownscaler({ maxDimension: 2000 })],
});
```
