---
'@mastra/deployer': minor
---

Added `bundler.entries` so `mastra build` can emit extra process entries next to the server bundle.

A Mastra app that runs a second long-running process, such as a LiveKit voice worker, previously had to bundle that process with its own toolchain because `mastra build` only emitted `index.mjs`. Declare the extra entries in your Mastra config instead:

```typescript title="src/mastra/index.ts"
export const mastra = new Mastra({
  bundler: {
    entries: { 'voice-worker': './voice-worker.ts' },
    externals: true,
  },
});
```

`mastra build` now emits `.mastra/output/voice-worker.mjs` beside `.mastra/output/index.mjs`. Both share one output directory, one `package.json`, and one dependency install, so a single build produces one deployable artifact you start with different commands:

```bash
node .mastra/output/index.mjs              # server
node .mastra/output/voice-worker.mjs start # worker
```

Dependencies imported only by an extra entry are analyzed too, so they land in the generated `package.json` and resolve at runtime.

Entry names may contain `/` to nest the output, but cannot be `index` (the server bundle), `tools` (the tool aggregator), or start with `tools/` (tool bundles).
