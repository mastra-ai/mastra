---
'@mastra/railway': patch
---

Improved Railway sandbox recovery and checkpoint management:

- A configured `sandboxId` reconnects when the sandbox is running, or creates a replacement when it is missing or stopped.
- Use `captureCheckpoint()` to save a recovery point on demand. Saved checkpoints provide the baseline filesystem for new sandboxes; `stop()` captures one before teardown and `destroy()` removes it.
- `start()` no longer resolves `template`. The option is still accepted and copied by `clone()`, but has no effect: callers receive neither a custom base image nor an error.

