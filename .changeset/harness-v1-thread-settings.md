---
'@mastra/core': minor
---

Added `harness.threads.setSettings(...)`, `getSettings(...)`, and `getSetting(...)` for persistent Harness v1 thread settings.

Settings are a shallow-merge view over `thread.metadata`. The API is patch-shaped — `setSettings({ patch })` shallow-merges into existing metadata, with `value: undefined` removing the key — matching `Session.setState()` semantics so callers don't have to learn a second write model. Multiple related settings can land atomically in one call.

- `harness.threads.setSettings({ resourceId, threadId, patch })` — shallow-merge patch. No-op writes are skipped (no storage round-trip, no event).
- `harness.threads.getSettings({ resourceId, threadId })` — returns a frozen snapshot of all settings.
- `harness.threads.getSetting({ resourceId, threadId, key })` — convenience single-key read.
- Emits `thread_settings_changed` with `{ patch, removedKeys }` carrying only real diffs.
- Cross-resource access throws `HarnessThreadNotFoundError` — existence is never leaked across resources.

```ts
await harness.threads.setSettings({
  resourceId: 'tenant-42',
  threadId,
  patch: {
    preferredModel: 'openai:gpt-4.1',
    archived: false,
  },
});

const settings = await harness.threads.getSettings({ resourceId: 'tenant-42', threadId });
const preferredModel = await harness.threads.getSetting({
  resourceId: 'tenant-42',
  threadId,
  key: 'preferredModel',
});
```
