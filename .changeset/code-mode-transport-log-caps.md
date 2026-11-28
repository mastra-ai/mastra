---
'@mastra/quickjs': minor
'@mastra/isolated-vm': minor
---

Both transports now bound the console logs they capture during execution when the run sets a log cap, so a chatty or long-running program can no longer grow a transport's log buffer without bound. Each retained line costs at least one byte, so `maxLogBytes` also caps the number of lines, and an overflowing log truncates instead of failing the program.

The packages now require `@mastra/core >=1.87.0-0 <2.0.0-0`, because they use the per-run log-cap options and the shared log collector added in this release.

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
