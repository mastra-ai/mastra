---
'@mastra/factory': minor
---

Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed).
