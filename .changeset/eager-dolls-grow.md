---
'@mastra/core': patch
---

Added `collectToolMocks` export to `@mastra/core/evals`. The helper walks a `TrajectoryStep[]` and returns `DatasetItemToolMock[]`, collecting top-level `tool_call` and `mcp_tool_call` steps in recorded order (sub-agent delegations are emitted as `matchArgs: 'ignore'`). Consumers can now derive item-level tool mocks from a hydrated trajectory directly from `@mastra/core`.

```ts
import { collectToolMocks } from '@mastra/core/evals';
import type { Trajectory } from '@mastra/core/evals';

const mocks = collectToolMocks(trajectory.steps);
```
