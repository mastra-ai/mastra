---
'@mastra/connect': minor
---

Added GitLab, Neon, Cloudflare, Resend, and Anthropic toolsets. All nine Mastra platform integrations now have toolsets, so agents can work with GitLab projects and merge requests, Neon Postgres branches, Cloudflare DNS, Resend email, and Anthropic models over platform-managed connections — no provider credentials in your app:

```ts
import { Agent } from '@mastra/core/agent';
import {
  createGitlabTools,
  createNeonTools,
  createCloudflareTools,
  createResendTools,
  createAnthropicTools,
} from '@mastra/connect';

const agent = new Agent({
  name: 'ops',
  instructions: 'You manage our infrastructure.',
  model: 'openai/gpt-5-mini',
  toolsets: {
    gitlab: createGitlabTools({ allowTools: ['gitlab_list_projects', 'gitlab_list_merge_requests'] }),
    neon: createNeonTools(),
    cloudflare: createCloudflareTools(),
    resend: createResendTools(),
    anthropic: createAnthropicTools(),
  },
});
```
