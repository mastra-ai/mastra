---
'@mastra/evals': minor
---

Added `checks`, a new namespace of micro-scorers for common eval assertions.

**What changed**
- Added text checks: `includes`, `excludes`, `equals`, `matches`, and `similarity`.
- Added tool checks: `calledTool`, `didNotCall`, `toolOrder`, `maxToolCalls`, `usedNoTools`, and `noToolErrors`.
- You can now import checks from `@mastra/evals/checks`.

**Example**
```ts
import { checks } from '@mastra/evals/checks';

const scorers = [
  checks.includes('sunny'),
  checks.calledTool('get_weather'),
  checks.toolOrder(['search', 'summarize']),
  checks.noToolErrors(),
];
```
