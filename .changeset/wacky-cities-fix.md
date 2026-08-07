---
'@mastra/railway': patch
---

Improved Railway sandbox lifecycle behavior:

- A configured `sandboxId` reconnects when the sandbox is running, or creates a replacement when it is missing or stopped.
- Saved checkpoints provide the baseline filesystem for new sandboxes. A checkpoint is captured before `stop()` tears down the sandbox and removed during `destroy()`.
- `start()` no longer resolves `template`. The option is still accepted and copied by `clone()`, but has no effect: callers receive neither a custom base image nor an error.

**New**

Call `captureCheckpoint()` to save a recovery point at any time, without waiting for the idle timer.

