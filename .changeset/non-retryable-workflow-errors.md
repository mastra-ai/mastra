---
'@mastra/core': patch
'@mastra/inngest': patch
---

Add MastraNonRetryableError for workflow steps to signal permanent failures and skip retries

```ts
import { MastraNonRetryableError } from '@mastra/core/error';

throw new MastraNonRetryableError('Invalid template ID');