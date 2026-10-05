---
'@mastra/client-js': minor
---

Added skills.sh registry methods to the workspace client: `searchSkillsSh`, `listPopularSkillsSh`, `previewSkillsSh`, `installSkillsSh`, `removeSkillsSh` and `updateSkillsSh`. Parameters and responses are typed from the server routes.

```ts
const workspace = client.getWorkspace('my-workspace');
const { skills } = await workspace.listPopularSkillsSh({ limit: 10 });
await workspace.installSkillsSh({ owner: 'vercel-labs', repo: 'skills', skillName: 'find-skills' });
```
