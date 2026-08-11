---
'@mastra/core': patch
---

Dynamic agent skills resolvers now run inside a dedicated `SKILL_RESOLUTION` span type instead of `GENERIC`, and the `resolve-skills` span reports `agentId` and `skillCount` as typed span attributes. If you filter or query traces by span type, the resolver span's type value changed from `generic` to `skill_resolution`.
