---
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real.

```ts
// Gate checkpoint-dependent work on the provider's capability flag.
if (sandbox.supportsCheckpoints) {
  await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
}
```
