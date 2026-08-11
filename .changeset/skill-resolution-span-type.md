---
'@mastra/core': patch
---

Added a dedicated `SKILL_RESOLUTION` span type for dynamic agent skills resolvers, replacing the `GENERIC` type the `resolve-skills` span used before. The span now reports `agentId` and `skillCount` as typed span attributes. If you filter or query traces by span type, the resolver span's type value changed from `generic` to `skill_resolution`.
