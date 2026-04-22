export type ChannelFixture = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const channelsFixture: ChannelFixture[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Let your team chat with the agent from any Slack channel or DM.',
    enabled: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Deploy the agent inside Teams channels and private chats.',
    enabled: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Run the agent as a bot inside a Discord server.',
    enabled: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Reply to inbound email threads with agent-generated responses.',
    enabled: false,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Trigger the agent from any HTTP endpoint you control.',
    enabled: false,
  },
  {
    id: 'sms',
    name: 'SMS',
    description: 'Answer text messages sent to a connected phone number.',
    enabled: false,
  },
];
