---
'@mastra/quickjs': minor
'@mastra/isolated-vm': minor
---

Both transports now bound the console logs they capture during execution when the run sets a log cap, so a chatty or long-running program can no longer grow a transport's log buffer without bound. Each retained line costs at least one byte, so `maxLogBytes` also caps the number of lines, and an overflowing log truncates instead of failing the program.

The packages now require `@mastra/core >=1.87.0-0 <2.0.0-0`, because they use the per-run log-cap options and the shared log collector added in this release. The `-0` admits the unreleased `1.87.0` prerelease line that carries the collector; `@mastra/core` and these transports are published together.

Pass the caps to `createCodeMode()`; the transport applies them while it runs the program:

```typescript
import { createCodeMode } from '@mastra/core/tools'
import { QuickJsCodeModeTransport } from '@mastra/quickjs'

const { tool, instructions } = createCodeMode(
  { tools: { getTopProducts }, maxLogBytes: 8192, maxLogLines: 200 },
  new QuickJsCodeModeTransport(),
)
```

`IsolatedVmCodeModeTransport` behaves the same. Both caps are optional: `maxLogBytes` also bounds the line count (each retained line costs at least one byte), and either cap truncates the logs instead of failing the run.

**Before** — an older core cannot satisfy the new peer requirement:

```json
{
  "@mastra/core": "1.86.0",
  "@mastra/quickjs": "0.1.0"
}
```

**After** — upgrade `@mastra/core` to `1.87.0-0` or later first, then upgrade the transport:

```json
{
  "@mastra/core": ">=1.87.0-0 <2.0.0-0",
  "@mastra/quickjs": "0.2.0"
}
```

The same applies to `@mastra/isolated-vm`.
