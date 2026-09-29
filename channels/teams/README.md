# @mastra/teams

`@mastra/teams` connects Mastra agents to Microsoft Teams through the Bot Framework. It manages bot installations, JWT-verified activity webhooks, per-agent bot provisioning via Microsoft Graph and the Teams Developer Portal, adaptive cards, and streaming replies over Mastra's channel lifecycle.

## Installation

```bash
npm install @mastra/teams
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { TeamsProvider } from '@mastra/teams';

const supportAgent = new Agent({
  id: 'support',
  name: 'Support agent',
  instructions: 'Help users with product questions.',
  model: 'openai/gpt-5-mini',
});

// Self-managed: bring your own Azure Bot registration.
const teams = new TeamsProvider({
  appId: process.env.TEAMS_APP_ID!,
  appPassword: process.env.TEAMS_APP_PASSWORD!,
  baseUrl: 'https://your-app.example.com',
});

export const mastra = new Mastra({
  agents: { supportAgent },
  channels: { teams },
});

await teams.connect('support');
```

## Documentation

- [`TeamsProvider` reference](https://mastra.ai/reference/channels/teams-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/channels/teams/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
