---
'@mastra/core': minor
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground-ui': patch
---

Use skill path as the unique identifier instead of name throughout workspace skills APIs.

**Breaking change:** `WorkspaceSkills` methods and server routes now use `skillPath` (the filesystem path) instead of `skillName` as the key for skill lookup.

Before:
```ts
const skill = await workspaceSkills.get('my-skill');
await client.searchSkills({ skillNames: ['my-skill'] });
```

After:
```ts
const skill = await workspaceSkills.get('/path/to/my-skill');
await client.searchSkills({ skillPaths: ['/path/to/my-skill'] });
```

This prevents same-named skills from different directories from overwriting each other. `SkillMetadata` now includes a `path` field, and agent skill tools disambiguate duplicate names by prompting for the specific skill path when needed.
