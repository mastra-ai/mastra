---
'@mastra/server': patch
---

Bumped the `@mastra/core` peer dependency floor from `>=1.32.0-0` to `>=1.34.0-0`.

The stored-entity handlers, editor-builder routes, and the `ModelNotAllowedError` → HTTP 422 mapping pull runtime values from `@mastra/core/agent-builder/ee` (`assertModelAllowed`, `builderToModelPolicy`, `resolvePickerVisibility`, `isModelNotAllowedError`). That entry point was first published in `@mastra/core@1.34.0`, so consumers must upgrade `@mastra/core` to `1.34.0` or newer before installing this version of `@mastra/server`.
