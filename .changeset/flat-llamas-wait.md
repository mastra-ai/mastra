---
'@mastra/core': minor
---

Exported the `IsTaskCompletePayload` type from `@mastra/core/stream`.

This is the canonical shape of a task-completion verdict, so consumers can type their own task/completion UI against it instead of redeclaring it.

```ts
import type { IsTaskCompletePayload } from '@mastra/core/stream';
```
