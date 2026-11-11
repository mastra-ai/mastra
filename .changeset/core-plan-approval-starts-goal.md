---
'@mastra/core': patch
---

The coding-agent base prompt now says that approving a submitted plan starts it as a goal. Set `planApprovalStartsGoal: false` in the prompt context to say approval switches to Build mode without starting a goal and to leave out the `/goal` command.

```ts
import { buildBasePrompt } from '@mastra/core/coding-agent';

const prompt = buildBasePrompt({
  projectPath: '/repo',
  projectName: 'my-app',
  platform: 'linux',
  date: '2026-11-05',
  mode: 'plan',
  toolGuidance: '',
  planApprovalStartsGoal: false,
});
```
