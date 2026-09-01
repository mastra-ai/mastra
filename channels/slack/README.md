# @mastra/slack

Slack integration for Mastra agents with app factory, OAuth, and slash commands. Use `@mastra/slack` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/slack
```

## Usage

Set `SLACK_APP_CONFIG_REFRESH_TOKEN` to your Slack app configuration refresh token.

```typescript
import { SlackProvider } from '@mastra/slack';

const slack = new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
});
```

## Documentation

- [@mastra/slack documentation](https://mastra.ai/reference/channels/slack-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/channels/slack/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
