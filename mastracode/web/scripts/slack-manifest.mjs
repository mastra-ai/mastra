#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const usage = `Usage:
  pnpm slack:manifest --url <public-url> --name <app-name> [--copy]

Examples:
  pnpm slack:manifest --url https://mc-web.example.com --name "Mastra Factory (dev)"
  pnpm slack:manifest --url https://mc-web.example.com/ --name "Mastra Factory (dev)" --copy`;

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    name: { type: 'string' },
    copy: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

if (!values.url || !values.name) {
  console.error(usage);
  process.exit(1);
}

let baseUrl;
try {
  const parsed = new URL(values.url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported protocol');
  baseUrl = parsed.toString().replace(/\/$/, '');
} catch {
  console.error(`Invalid --url: ${values.url}`);
  process.exit(1);
}

const webhookUrl = `${baseUrl}/api/agent-controllers/mastra-code/channels/slack/webhook`;
const manifest = {
  display_information: {
    name: values.name,
    description: 'AI assistant powered by Mastra',
    background_color: '#000000',
  },
  features: {
    app_home: {
      home_tab_enabled: false,
      messages_tab_enabled: true,
      messages_tab_read_only_enabled: false,
    },
    bot_user: {
      display_name: values.name,
      always_online: true,
    },
    slash_commands: [
      {
        command: '/factory',
        url: webhookUrl,
        description: 'List or set your default factory for Slack sessions',
        usage_hint: '[factory name]',
        should_escape: false,
      },
    ],
    assistant_view: {
      assistant_description: 'AI assistant powered by Mastra',
    },
  },
  oauth_config: {
    redirect_urls: [`${baseUrl}/slack/oauth/callback`, `${baseUrl}/connect/slack/oidc/callback`],
    scopes: {
      bot: [
        'commands',
        'chat:write',
        'chat:write.public',
        'im:write',
        'channels:history',
        'channels:read',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'mpim:history',
        'mpim:read',
        'app_mentions:read',
        'users:read',
        'reactions:write',
        'files:read',
        'assistant:write',
      ],
    },
    pkce_enabled: false,
  },
  settings: {
    event_subscriptions: {
      request_url: webhookUrl,
      bot_events: ['app_mention', 'message.channels', 'message.groups', 'message.im', 'message.mpim'],
    },
    interactivity: {
      is_enabled: true,
      request_url: webhookUrl,
    },
    org_deploy_enabled: false,
    socket_mode_enabled: false,
    token_rotation_enabled: false,
    is_mcp_enabled: false,
  },
};

const output = JSON.stringify(manifest, null, 2);

if (values.copy) {
  const result = spawnSync('pbcopy', { input: output });
  if (result.error || result.status !== 0) {
    console.error('Could not copy the manifest with pbcopy. Run without --copy to print it instead.');
    process.exit(1);
  }
  console.log('Manifest copied to clipboard.');
} else {
  process.stdout.write(`${output}\n`);
}
