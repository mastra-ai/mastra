# @mastra/slack

`@mastra/slack` connects Mastra agents to Slack. It creates and configures Slack apps through the Manifest API, manages the OAuth installation flow, and routes Slack conversations to agents registered with Mastra.

## Installation

```bash
npm install @mastra/slack
```

## Usage

Set `SLACK_APP_CONFIG_REFRESH_TOKEN` to your Slack app configuration refresh token.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { SlackProvider } from '@mastra/slack';

const slack = new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
});

export const mastra = new Mastra({
  channels: { slack },
});
```

## Documentation

- [Reference: SlackProvider](https://mastra.ai/reference/channels/slack-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/channels/slack/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
