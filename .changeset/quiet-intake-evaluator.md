---
'@mastra/factory': patch
---

Removed the `intake.evaluator` option from `MastraFactory`. New projects already use the intake order, so the option only mattered for older projects. To keep every project on the old route list, or to move all older projects at once, set `FACTORY_INTAKE_EVALUATOR` (`route-list` or `intake-order`) the same on every replica. `GET /web/factory/projects/:id/intake-order` no longer reports `evaluatorSource: 'option'`.
