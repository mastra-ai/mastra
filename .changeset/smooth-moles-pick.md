---
'@mastra/vercel': patch
---

Added `VercelSandbox.extendTimeout(ms)` to keep a running MicroVM session alive for longer. Call it when a run would otherwise outlive the sandbox timeout created at construction:

```typescript
const sandbox = new VercelSandbox({ timeout: 300_000 })
await sandbox.start()

await sandbox.extendTimeout(600_000)
```

If the sandbox isn't running yet, `extendTimeout()` starts it first, and repeated calls reuse the same session instead of creating a new one. Vercel's plan-level maximum session duration still applies, and exceeding it rejects with the provider error unchanged.
