---
'@mastra/client-js': minor
'@mastra/core': minor
---

Add version-aware code-agent lookup and override version lifecycle support.

`Mastra.getAgent(name, version)` and `Mastra.getAgentById(id, version)` can now resolve draft or specific stored override versions when the editor package is configured, and throw a clear error when versioned lookup is requested without the editor.

`client.getAgent(id, version)` now carries version selection through agent detail and voice metadata requests, and the `Agent` resource now supports override version management methods including `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, and `compareVersions`.

`Agent.createVersion(...)` is intentionally limited to code-agent overrideable fields plus version metadata, rather than the full stored-agent configuration surface.
