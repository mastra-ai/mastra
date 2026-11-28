---
'@mastra/quickjs': minor
'@mastra/isolated-vm': minor
---

Both transports now bound the console logs they capture during execution when the run sets a log cap, so a chatty or long-running program can no longer grow a transport's log buffer without bound. Each retained line costs at least one byte, so `maxLogBytes` also caps the number of lines, and an overflowing log truncates instead of failing the program.

The packages now require `@mastra/core >=1.87.0-alpha.8 <2.0.0-0`, because they use the per-run log-cap options and the shared log collector that this release adds. `1.87.0-alpha.8` is the first release that exports `createCodeModeLogCollector`, so the floor names that prerelease instead of the `>=1.87.0-0 <2.0.0-0` sentinel used elsewhere: the sentinel also admits `1.87.0-alpha.0` through `1.87.0-alpha.7`, which satisfy it but do not export the collector, and the transports fail to load against them.

Upgrade `@mastra/core` to `1.87.0-alpha.8` or newer — `1.87.0` once it ships — whenever you upgrade a transport; the two are published together. The range still passes `scripts/validate-peerdeps.mjs`, which validates peer ranges after `changeset pre exit && changeset version` has bumped `@mastra/core` to `1.87.0`.

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

**After** — upgrade `@mastra/core` to `1.87.0-alpha.8` or newer along with the transport:

```json
{
  "@mastra/core": ">=1.87.0-alpha.8 <2.0.0-0",
  "@mastra/quickjs": "0.2.0"
}
```

The same applies to `@mastra/isolated-vm`.
