---
'@mastra/core': minor
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Add optional `?path=` query param to workspace skill routes for disambiguating same-named skills.

Skill routes continue to use `:skillName` in the URL path (no breaking change). When two skills share the same name (e.g. from different directories), pass the optional `?path=` query parameter to select the exact skill:

```
GET /workspaces/:workspaceId/skills/:skillName?path=skills/brand-guidelines
```

`SkillMetadata` now includes a `path` field, and the `list()` method returns all same-named skills for disambiguation. The client SDK's `getSkill()` accepts an optional `skillPath` parameter for disambiguation.
