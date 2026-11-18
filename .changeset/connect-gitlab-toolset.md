---
'@mastra/connect': minor
---

Added a GitLab toolset with 44 tools. Agents can manage projects, groups, issues, merge requests, branches, files, commits, and releases, and create, cancel, and retry pipelines and jobs.

Connect a GitLab account to your project first (`mastra connect add gitlab`), then add the tools to an agent:

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const gitlabAgent = new Agent({
  id: 'gitlab-agent',
  name: 'GitLab agent',
  instructions: 'Use the connected GitLab tools to triage issues and review merge requests.',
  model: 'openai/gpt-5.6',
  tools: tools({ providers: ['gitlab'] }),
});
```

Project, group, and file paths work raw (`team/app`) or URL-encoded (`team%2Fapp`). Project results never include the project's runner registration token.
