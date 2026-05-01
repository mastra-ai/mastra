import { describe, it, expect } from 'vitest';

import { buildManifest, DEFAULT_BOT_SCOPES, DEFAULT_BOT_EVENTS } from './manifest';

describe('buildManifest', () => {
  const baseOptions = {
    name: 'Test Bot',
    webhookUrl: 'https://example.com/webhooks/abc',
    oauthRedirectUrl: 'https://example.com/slack/oauth/callback',
  };

  it('produces a valid manifest with required fields', () => {
    const manifest = buildManifest(baseOptions);

    expect(manifest.display_information.name).toBe('Test Bot');
    expect(manifest.features?.bot_user?.display_name).toBe('Test Bot');
    expect(manifest.settings?.event_subscriptions?.request_url).toBe(baseOptions.webhookUrl);
    expect(manifest.oauth_config?.redirect_urls).toEqual([baseOptions.oauthRedirectUrl]);
  });

  it('uses default description when none provided', () => {
    const manifest = buildManifest(baseOptions);
    expect(manifest.display_information.description).toBe('Test Bot - Powered by Mastra');
  });

  it('uses custom description when provided', () => {
    const manifest = buildManifest({ ...baseOptions, description: 'My custom bot' });
    expect(manifest.display_information.description).toBe('My custom bot');
  });

  it('includes default bot scopes', () => {
    const manifest = buildManifest(baseOptions);
    const scopes = manifest.oauth_config?.scopes?.bot ?? [];

    for (const scope of DEFAULT_BOT_SCOPES) {
      expect(scopes).toContain(scope);
    }
  });

  it('includes default bot events', () => {
    const manifest = buildManifest(baseOptions);
    const events = manifest.settings?.event_subscriptions?.bot_events ?? [];

    for (const event of DEFAULT_BOT_EVENTS) {
      expect(events).toContain(event);
    }
  });

  it('enables app_home messages tab', () => {
    const manifest = buildManifest(baseOptions);
    expect(manifest.features?.app_home?.messages_tab_enabled).toBe(true);
    expect(manifest.features?.app_home?.messages_tab_read_only_enabled).toBe(false);
  });

  it('enables interactivity', () => {
    const manifest = buildManifest(baseOptions);
    expect(manifest.settings?.interactivity?.is_enabled).toBe(true);
  });

  describe('slash commands', () => {
    it('does not include commands scope without slash commands', () => {
      const manifest = buildManifest(baseOptions);
      const scopes = manifest.oauth_config?.scopes?.bot ?? [];
      expect(scopes).not.toContain('commands');
    });

    it('adds commands scope when slash commands are present', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask', description: 'Ask a question' }],
      });
      const scopes = manifest.oauth_config?.scopes?.bot ?? [];
      expect(scopes).toContain('commands');
    });

    it('auto-prepends / to command names', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: 'ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.command).toBe('/ask');
    });

    it('does not double-prepend / to command names', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.command).toBe('/ask');
    });

    it('uses webhook URL as default commands URL', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.url).toBe(baseOptions.webhookUrl);
    });

    it('uses custom commands URL when provided', () => {
      const commandsUrl = 'https://example.com/commands/abc';
      const manifest = buildManifest({
        ...baseOptions,
        commandsUrl,
        slashCommands: [{ command: '/ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.url).toBe(commandsUrl);
    });

    it('includes usage_hint when provided', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask', description: 'Ask', usageHint: '[your question]' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.usage_hint).toBe('[your question]');
    });

    it('omits usage_hint when not provided', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]).not.toHaveProperty('usage_hint');
    });

    it('uses default description for commands', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [{ command: '/ask' }],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands[0]?.description).toBe('Run /ask');
    });

    it('handles multiple commands', () => {
      const manifest = buildManifest({
        ...baseOptions,
        slashCommands: [
          { command: '/ask', description: 'Ask a question' },
          { command: '/summarize', description: 'Summarize text' },
        ],
      });
      const commands = manifest.features?.slash_commands ?? [];
      expect(commands).toHaveLength(2);
      expect(commands[0]?.command).toBe('/ask');
      expect(commands[1]?.command).toBe('/summarize');
    });
  });
});
