import { Hono } from '@emulators/core';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlackProvider } from './provider';
import { startSlackEmulator, type SlackEmulator } from './__tests__/slack-emulator';

/**
 * Config-drift lifecycle, exercised end-to-end against the in-process Slack emulator.
 *
 * Drift is evaluated in `SlackProvider.#doInitialize()` (one per `initialize()`), comparing a
 * hash of `{ resolvedAppName, resolvedDescription, slashCommands, baseUrl }` against the stored
 * `configHash`. We simulate a process restart with mutated agent config by constructing a fresh
 * provider that shares the same persistent storage + emulator, then calling `initialize()`.
 */
describe('SlackProvider config drift (emulator)', () => {
  let emulator: SlackEmulator;
  let storage: InMemoryStore;

  const AGENT_ID = 'support-agent';

  beforeEach(async () => {
    emulator = await startSlackEmulator(
      {
        team: { name: 'Acme', domain: 'acme' },
        users: [{ name: 'installer', real_name: 'Installer', is_admin: true }],
      },
      { registerManifestRoutes: true },
    );
    storage = new InMemoryStore();
  });

  afterEach(async () => {
    await emulator.close();
  });

  function makeAgent(name: string, instructions = 'You help users.') {
    return new Agent({ id: AGENT_ID, name, instructions, model: {} as never });
  }

  function makeProvider() {
    return new SlackProvider({
      apiUrl: `${emulator.url}/api`,
      baseUrl: emulator.url,
      refreshToken: 'xoxe-1-test-refresh-token',
      token: 'xoxe.xoxp-test-config-token',
    });
  }

  function attach(provider: SlackProvider, agent: Agent) {
    const mastra = new Mastra({
      agents: { support: agent },
      storage: storage as never,
    });
    provider.__attach(mastra);
    return mastra;
  }

  /** Run a full OAuth install so a persisted active installation exists. */
  async function install(appName: string): Promise<void> {
    const provider = makeProvider();
    const mastra = attach(provider, makeAgent(appName));

    const result = await provider.connect(AGENT_ID);
    const state = new URL(result.authorizationUrl).searchParams.get('state')!;
    const oauthApp = emulator.slackStore.oauthApps.all()[0];
    const installer = emulator.slackStore.users.all()[0];
    const code = await emulator.mintOAuthCode({
      clientId: oauthApp.client_id,
      redirectUri: `${emulator.url}/slack/oauth/callback`,
      userId: installer.user_id,
      state,
    });

    const app = new Hono();
    const route = provider.getRoutes().find(r => r.path === '/slack/oauth/callback')!;
    app.get(route.path, async c => {
      const handler = await route.createHandler({ mastra } as never);
      return (handler as (ctx: unknown) => Promise<Response>)(c);
    });
    const res = await app.request(`/slack/oauth/callback?${new URLSearchParams({ code, state })}`);
    expect(res.status).toBe(302);
  }

  /** Fresh provider sharing the same storage/emulator, attached to an agent, then initialized. */
  async function reinitialize(agent: Agent): Promise<SlackProvider> {
    const provider = makeProvider();
    attach(provider, agent);
    await provider.initialize();
    return provider;
  }

  it('detects an agent rename and pushes a manifest update with a new configHash', async () => {
    await install('Support Agent');
    const before = await (async () => {
      const p = makeProvider();
      attach(p, makeAgent('Support Agent'));
      return p.getInstallation(AGENT_ID);
    })();
    expect(before).not.toBeNull();
    const updatesBefore = emulator.manifestCalls().filter(c => c.action === 'update').length;

    // Restart with a renamed agent → resolvedAppName changes → drift.
    const provider = await reinitialize(makeAgent('Renamed Support Agent'));

    const after = await provider.getInstallation(AGENT_ID);
    expect(after!.configHash).not.toBe(before!.configHash);
    const updatesAfter = emulator.manifestCalls().filter(c => c.action === 'update').length;
    expect(updatesAfter).toBe(updatesBefore + 1);
  });

  it('detects a baseUrl change, updates the manifest, and keeps the same webhookId', async () => {
    await install('Support Agent');
    const before = await (async () => {
      const p = makeProvider();
      attach(p, makeAgent('Support Agent'));
      return p.getInstallation(AGENT_ID);
    })();

    // Restart with a different baseUrl → drift (manifest URLs rebuilt with new base).
    const provider = makeProvider();
    attach(provider, makeAgent('Support Agent'));
    provider.setBaseUrl('https://new-host.example.com');
    await provider.initialize();

    const after = await provider.getInstallation(AGENT_ID);
    expect(after!.configHash).not.toBe(before!.configHash);
    // Webhook routing key is stable across a baseUrl change.
    expect(after!.webhookId).toBe(before!.webhookId);
    expect(emulator.manifestCalls().some(c => c.action === 'update')).toBe(true);
  });

  it('does not push a manifest update when config is unchanged', async () => {
    await install('Support Agent');
    const updatesBefore = emulator.manifestCalls().filter(c => c.action === 'update').length;

    // Restart with identical config → no drift.
    await reinitialize(makeAgent('Support Agent'));

    const updatesAfter = emulator.manifestCalls().filter(c => c.action === 'update').length;
    expect(updatesAfter).toBe(updatesBefore);
  });

  it('evicts caches and deletes the installation when the Slack app is gone', async () => {
    await install('Support Agent');
    const before = await (async () => {
      const p = makeProvider();
      attach(p, makeAgent('Support Agent'));
      return p.getInstallation(AGENT_ID);
    })();
    expect(before).not.toBeNull();

    // Simulate the app being deleted from Slack: manifest.update now returns app_not_found.
    const app = emulator.slackStore.oauthApps.findOneBy('app_id', before!.appId);
    expect(app).toBeDefined();
    emulator.slackStore.oauthApps.delete(app!.id);

    // Restart with mutated config so drift is detected and the update call fails app_not_found.
    const provider = await reinitialize(makeAgent('Renamed Support Agent'));

    // Installation is removed; webhook routing can no longer resolve it.
    const after = await provider.getInstallation(AGENT_ID);
    expect(after).toBeNull();
  });
});
