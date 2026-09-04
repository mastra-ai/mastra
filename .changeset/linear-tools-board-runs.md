---
'@mastra/factory': patch
---

Fixed Linear agent tools never reaching a Factory board run. `buildLinearAgentTools` resolved the org from the session `resourceId`, which for a bound run is the per-work-item session id rather than the factory project id `resolveOrgId` looks up — so every board run was handed an empty tool set and lost `linear_get_issue` and `linear_create_comment` without any error. The project now comes from the bound run's controller state, falling back to `resourceId` for project-scoped sessions.
