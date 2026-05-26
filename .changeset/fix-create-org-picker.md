---
'mastra': patch
---

fix(cli): always show org picker for multi-org users during observability setup

Restores the `forcePrompt: true` flag for `resolveCurrentOrg` in `create` mode so that users with multiple organizations are always prompted to choose one, even if they already have a persisted org selection.
