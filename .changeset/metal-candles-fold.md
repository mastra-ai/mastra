---
'@mastra/factory': patch
---

Fixed model pickers offering models that an organization-scoped Factory cannot run. `GET /web/config/models` accepts an optional `factoryId` and then lists only models served by that Factory's model scope (organization credentials for organization scope, personal credentials for personal scope). Personal model settings now note when the current Factory uses organization credentials only.
