---
'@mastra/core': minor
---

Added `OMProgressSummary` and `omProgressSummary()`: the status-line reading of observational memory, with each budget's pending pass already resolved into a token figure.

Anything drawing a memory status line now reads the same figures the TUI does, instead of walking the buffered bookkeeping itself:

```ts
import { omProgressSummary } from '@mastra/core/agent-controller/types';

const { pendingTokens, threshold, projectedMessageRemoval } = omProgressSummary(displayState.omProgress);
```

`@mastra/core/agent-controller/types` is a new entry point carrying the AgentController types and their defaults with no runtime dependencies, so a browser bundle can reach them. The existing `@mastra/core/agent-controller` exports the same symbols but also pulls in the controller and its tools, which do not run in a browser.
