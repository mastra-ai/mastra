---
'@mastra/connect': minor
---

Added a GitLab toolset with 44 tools. Agents can manage projects, groups, issues, merge requests, branches, files, commits, and releases, create and cancel pipelines, and retry jobs.

Connect a GitLab account to your project first (`mastra connect add gitlab`). When running locally, set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` in the app's environment so `tools()` can find the connection. Then add the tools to an agent:

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

Project and group paths work raw (`team/app`) or URL-encoded (`team%2Fapp`). Branch names, file paths, and tag names are sent as given, so `release%2Fnext` and `release/next` stay distinct. Project results never include the project's runner registration token.

Tools refuse ambiguous or no-op input before calling GitLab: an update with nothing to change, a commit action missing the field it needs, a release with duplicate asset links, or a merge request update naming the milestone both by id and by title.
