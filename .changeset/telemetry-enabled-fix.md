---
"@mastra/core": patch
---

Fix telemetry disabled configuration being ignored by decorators

The `hasActiveTelemetry()` function now properly checks the `enabled` configuration flag before creating spans. Previously, it only checked if a tracer existed (which always returns true in OpenTelemetry), causing decorators to create spans even when `telemetry: { enabled: false }` was set.

**What changed:**
- Added short-circuit evaluation in `hasActiveTelemetry()` to check `globalThis.__TELEMETRY__?.isEnabled()` before checking for tracer existence
- This prevents unnecessary span creation overhead when telemetry is disabled

**How to use:**
```typescript
// Telemetry disabled at initialization
const mastra = new Mastra({
  telemetry: { enabled: false }
});

// Or disable at runtime
Telemetry.setEnabled(false);
```

**Breaking changes:** None - this is a bug fix that makes the existing API work as documented.
