---
'@mastra/core': minor
---

Added `OMProgressSummary` and `omProgressSummary()`: the status-line reading of observational memory, with each budget's pending pass already resolved into a token figure.

Anything drawing a memory status line now reads the same figures the TUI does, instead of walking the buffered bookkeeping itself:

```ts
import { omProgressSummary } from '@mastra/core/agent-controller';

const { pendingTokens, threshold, projectedMessageRemoval } = omProgressSummary(displayState.omProgress);
```
