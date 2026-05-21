---
'@mastra/server': patch
---

Add test coverage for `MastraServer.validateAgentBuilderLicense()` startup guard. Locks in dev bypass, production throw, and missing-module throw behavior so future EE changes cannot silently regress the Agent Builder license check.
