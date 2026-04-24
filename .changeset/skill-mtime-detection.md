---
'@mastra/core': patch
---

Add opt-in `checkSkillFileMtime` option to detect in-place SKILL.md edits during hot reload.

Previously, only directory mtime was checked for skill staleness, so editing a skill's name (to fix a validation error) or updating its description wouldn't trigger re-discovery until server restart.

The option is off by default since it doubles `stat()` calls per skill during staleness checks. Recommended for local development only, not for cloud storage backends where `stat()` has higher latency.

```ts
const myAgent = new Agent({
  workspace: {
    filesystem: new LocalFilesystem({ basePath: process.cwd() }),
    skills: ['./**/skills'],
    checkSkillFileMtime: true, // Enable for local dev
  },
});
```
