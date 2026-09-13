---
'@mastra/core': patch
---

Fixed `structuredOutput` with a separate `model` so that a schema validation failure inside the structuring run honours the caller's `errorStrategy` and logger. Previously the structuring agent always ran in `strict` mode with a default console logger, so every failure printed `Error in agent stream` at error level to the console — even under `errorStrategy: 'warn'` or `'fallback'`, and even when the agent was registered on a `Mastra` instance with its own logger. The structuring agent now uses the agent's logger, the `warn`/`fallback` strategy is applied inside the structuring run, and `errorStrategy: 'warn'` warnings now reach the configured logger (`MastraModelOutput` accepts a `logger` option and the agent loop passes its own). The `object-result` chunk emitted for a substituted `fallbackValue` now carries `metadata.fallback: true` on both the native and the structuring-model paths.

**Before** (`errorStrategy: 'warn'`, agent on a `Mastra` with a `PinoLogger`):

```text
[Mastra] Error in agent stream { error: MastraError: Structured output validation failed: - root: model output is not an object ... }   # console.error, every time
```

**After**: one `warn` line through the configured logger, `result.object` is `undefined`, nothing on the console.
