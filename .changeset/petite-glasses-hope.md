---
'@mastra/core': patch
---

Fixed agent runs crashing with `RangeError: Invalid string length` when a command printed a very large amount of output. `sandbox.executeCommand()` now keeps the newest 1 MiB of stdout and stderr by default, the same limit spawned processes already use. Streaming callbacks still receive every chunk, and the result reports `stdoutTruncated` and `stdoutDroppedBytes` (and the stderr equivalents) when output was dropped.

If you need the complete output, pass `maxRetainedBytes: Infinity`:

```ts
// Before: all output was kept by default
const result = await sandbox.executeCommand('cat', ['data.json']);

// After: pass Infinity to keep all output
const result = await sandbox.executeCommand('cat', ['data.json'], { maxRetainedBytes: Infinity });
```
