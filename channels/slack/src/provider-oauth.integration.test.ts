import { Hono } from '@emulators/core';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlackProvider } from './provider';
import { startSlackEmulator, type SlackEmulator } from './__tests__/slack-emulator';

/**
 * OAuth install lifecycle, exercised end-to-end against an in-process Slack emulator
 * (no network, no Docker). Drives the real `SlackProvider.connect()` → manifest create →
 * `oauth.v2.access` exchange → installation persistence path through the `apiUrl` seam.
 */
describe('SlackProvider OAuth install (emulator)', () => {
  let emulator: SlackEmulator;

  beforeEach(async () => {
    emulator = await startSlackEmulator(
      {
        team: { name: 'Acme', domain: 'acme' },
        users: [{ name: 'installer', real_name: 'Installer', is_admin: true }],
      },
      { registerManifestRoutes: true },
    );
  });

  afterEach(async () => {
    await emulator.close();
  });

  function buildProvider() {
    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You help users.',
      model: {} as never,
    });
    const provider = new SlackProvider({
      apiUrl: `${emulator.url}/api`,
      baseUrl: emulator.url,
      // Bootstrap the manifest client so connect() can create an app.
      refreshToken: 'xoxe-1-test-refresh-token',
      token: 'xoxe.xoxp-test-config-token',
    });
    const mastra = new Mastra({
      agents: { support: agent },
      storage: new InMemoryStore() as never,
    });
    provider.__attach(mastra);
    return { provider, mastra };
  }

  /** Mount the provider's OAuth callback route on a real Hono app and drive a GET request. */
  async function callOAuthCallback(provider: SlackProvider, mastra: Mastra, code: string, state: string) {
    const app = new Hono();
    const route = provider.getRoutes().find(r => r.path === '/slack/oauth/callback')!;
    app.get(route.path, async c => {
      const handler = await route.createHandler({ mastra } as never);
      return (handler as (ctx: unknown) => Promise<Response>)(c);
    });
    const params = new URLSearchParams({ code, state });
    return app.request(`/slack/oauth/callback?${params.toString()}`);
  }

  it('creates an app, exchanges the OAuth code, and persists an active installation', async () => {
    const { provider, mastra } = buildProvider();

    // 1. connect() creates a Slack app via the emulator manifest routes and returns
    //    an authorization URL whose `state` is the pending installationId.
    const result = await provider.connect('support-agent');
    expect(result.type).toBe('oauth');
    const state = new URL(result.authorizationUrl).searchParams.get('state');
    expect(state).toBe(result.installationId);

    // The manifest create call hit the emulator and inserted a real oauth_app.
    expect(emulator.manifestCalls().some(c => c.action === 'create')).toBe(true);
    const oauthApp = emulator.slackStore.oauthApps.all()[0];
    expect(oauthApp).toBeDefined();

    // 2. Mint a real one-time code from the emulator's authorize callback for the
    //    seeded installer user + created app.
    const installer = emulator.slackStore.users.all()[0];
    const code = await emulator.mintOAuthCode({
      clientId: oauthApp.client_id,
      redirectUri: `${emulator.url}/slack/oauth/callback`,
      userId: installer.user_id,
      state: state!,
    });
    expect(code).toBeTruthy();

    // 3. Drive the provider's OAuth callback — exchanges the code via oauth.v2.access.
    const res = await callOAuthCallback(provider, mastra, code, state!);
    // Success path redirects (302) back with channel_connected=true.
    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(new URL(location, emulator.url).searchParams.get('channel_connected')).toBe('true');

    // 4. The installation is now active and carries the bot token + team from the exchange.
    const installation = await provider.getInstallation('support-agent');
    expect(installation).not.toBeNull();
    expect(installation!.botToken).toMatch(/^xoxb-/);
    expect(installation!.teamId).toBeTruthy();
    expect(installation!.botUserId).toBeTruthy();
    expect(installation!.appId).toBe(oauthApp.app_id);

    // The bot token issued by the emulator is recorded in its token store.
    const issued = emulator.slackStore.tokens.all().find(t => t.token === installation!.botToken);
    expect(issued).toBeDefined();
    expect(issued!.token_type).toBe('bot');
  });

  it('rejects a callback with an unknown state', async () => {
    const { provider, mastra } = buildProvider();
    const res = await callOAuthCallback(provider, mastra, 'irrelevant-code', 'unknown-state');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/Invalid or expired installation state/);
  });
});
