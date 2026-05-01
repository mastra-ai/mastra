---
'@mastra/slack': minor
---

Added @mastra/slack channel integration for connecting AI agents to Slack workspaces. Provides automatic Slack app provisioning via OAuth, manifest management with drift detection, encrypted credential storage, slash command support, and threaded conversation handling. Usage:

```ts
import { SlackProvider } from '@mastra/slack';

const mastra = new Mastra({
  channels: {
    slack: new SlackProvider({
      refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN!,
    }),
  },
});

// Connect an agent to Slack
const result = await mastra.channels.slack.connect('my-agent');
// result.type === 'oauth' → redirect user to result.authorizationUrl
```
