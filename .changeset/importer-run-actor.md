---
'@mastra/core': patch
---

Agentic Knowledge import runs now execute as the importer itself. Each run carries a system actor (`importer:<id>`) scoped to the organization declared on the importer registration (`organizationId`), so FGA-enabled deployments authorize import runs against that org instead of treating them as an anonymous caller. Registrations without an `organizationId` fail closed under FGA.
