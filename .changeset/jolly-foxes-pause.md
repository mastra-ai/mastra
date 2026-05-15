---
'@mastra/core': minor
---

Added `files` field to `SkillPublishResult` returned by `publishSkill`. Skill publish now builds a nested folder/file tree (`StorageSkillFileNode[]`) from the walked source files, with binary content base64-encoded, so consumers can persist the UI-facing file tree alongside the storage tree and blobs.

Also added two optional capability methods to `IMastraEditor`:

- `hasEnabledBuilderConfig?(): boolean` — synchronous check for whether a builder is configured and enabled.
- `resolveBuilder?(): Promise<IAgentBuilder | undefined>` — async accessor for the active builder instance.

These are opt-in extension points used by server-side handlers that need to gate behavior on the active builder.
