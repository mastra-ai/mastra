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

Complete output is limited to 256 MiB per stream. A command that prints more is killed, and `executeCommand()` (or `handle.wait()`) rejects with `ProcessOutputLimitError` instead of crashing the process.

The `execute_command` and `get_process_output` tools now tell the model when the start of the output was dropped, so it doesn't mistake the newest output for all of it.
