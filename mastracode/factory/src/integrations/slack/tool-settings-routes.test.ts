import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Mastra } from '@mastra/core';
import { AgentControllerChannels } from '@mastra/core/channels';
import { InMemoryStore } from '@mastra/core/storage';
import { createSlackAdapter } from '@mastra/slack';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { createSlackToolSettingsRoutes } from './tool-settings-routes.js';
import type { SlackToolSettings } from './tool-settings.js';

const TEAM = 'T1';

/**
 * Slack served over real HTTP. Caleb (UCALEB) is in #eng, #random and the
 * private #finance; the app is in #eng and #finance but not #random. #ops was
 * picked by someone else, and Caleb isn't in it.
 */
const channels = {
  eng: { id: 'C2', name: 'eng', is_private: false },
  random: { id: 'C5', name: 'random', is_private: false },
  finance: { id: 'G3', name: 'finance', is_private: true },
  ops: { id: 'C7', name: 'ops', is_private: false, is_member: true },
};
let joinError: string | undefined;
let calls: Array<{ method: string; args: Record<string, string> }> = [];
let server: ReturnType<typeof createServer>;
let apiUrl = '';

function answer(method: string, args: Record<string, string>): Record<string, unknown> {
  switch (method) {
    case 'auth.test':
      return { team_id: TEAM, user_id: 'UBOT', bot_id: 'BBOT' };
    case 'users.conversations':
      // With `user`, the channels that person is in that the app can see; without, the app's own.
      return args.user === 'UCALEB'
        ? { channels: [channels.random, channels.finance, channels.eng], response_metadata: { next_cursor: '' } }
        : { channels: args.user ? [] : [channels.eng], response_metadata: { next_cursor: '' } };
    case 'conversations.info':
      return args.channel === 'C7' ? { channel: channels.ops } : { ok: false, error: 'channel_not_found' };
    case 'conversations.join':
      return joinError ? { ok: false, error: joinError } : { channel: { id: args.channel } };
    case 'users.info':
      return { user: { id: args.user, name: args.user } };
    default:
      return { ok: false, error: 'unknown_method' };
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const method = req.url!.replace(/^\/api\//, '').split('?')[0]!;
      const args = Object.fromEntries(new URLSearchParams(body));
      calls.push({ method, args });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, ...answer(method, args) }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/`;
});

afterAll(() => server.close());

beforeEach(() => {
  calls = [];
  joinError = undefined;
});

/** Who's signed in comes from the `x-test-user` header, `user-1` in `org-1` by default. */
function testAuth() {
  const tenantOf = (c: Context) => {
    const header = c.req.header('x-test-user');
    if (header === 'none') return undefined;
    const [userId, orgId] = (header ?? 'user-1:org-1').split(':');
    return { userId: userId!, orgId };
  };
  return {
    enabled: () => true,
    ensureUser: async (c: Context) => tenantOf(c),
    tenant: (c: Context) => tenantOf(c),
    isOrganizationAdmin: async () => false,
  } as never;
}

async function settingsApp({ linked = true, defaults }: { linked?: boolean; defaults?: SlackToolSettings } = {}) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const adapter = createSlackAdapter({ botToken: 'xoxb-test', signingSecret: 'secret', apiUrl });
  const agentChannels = new AgentControllerChannels({ adapters: { slack: { adapter } } });
  agentChannels.__setController({ id: 'mastra-code', getMastra: () => mastra } as never);
  await agentChannels.initialize(mastra);

  const seed = await createFactoryStorageForTests();
  const factory = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
  const otherOrgFactory = await seed.projects.create({ orgId: 'org-2', userId: 'user-2', input: { name: 'Other' } });
  if (linked) {
    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: TEAM,
      externalUserId: 'UCALEB',
      orgId: 'org-1',
      userId: 'user-1',
    });
  }

  const app = new Hono();
  for (const route of createSlackToolSettingsRoutes({
    auth: testAuth(),
    projects: seed.projects,
    accountLinks: seed.channelIdentity,
    chat: () => agentChannels.sdk,
    defaults,
  })) {
    app.on([route.method], route.path, c =>
      (route as { handler: (c: Context) => Promise<Response> | Response }).handler(c),
    );
  }
  const request = async (method: string, path: string, body?: unknown, user?: string) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  calls = [];
  return { request, factory, otherOrgFactory, projects: seed.projects };
}

const path = (id: string) => `/web/factory/projects/${id}/slack-tools`;

describe('Settings › Slack tool access', () => {
  it("starts from the defaults, and lists nothing to pick until the caller connects Slack", async () => {
    const { request, factory } = await settingsApp({ linked: false });

    const { status, body } = await request('GET', path(factory.id));

    expect(status).toBe(200);
    expect(body).toEqual({
      settings: { channels: 'session', channelIds: [], channelAccess: 'post', directMessages: 'none' },
      channels: [],
      linked: false,
    });
    expect(calls).toEqual([]);
  });

  it("shows the deployment's settings for anything the Factory hasn't saved", async () => {
    const defaults: SlackToolSettings = { channels: 'all', channelIds: [], channelAccess: 'post', directMessages: 'anyone' };
    const { request, factory } = await settingsApp({ linked: false, defaults });

    expect((await request('GET', path(factory.id))).body.settings).toEqual(defaults);
  });

  it("lists the caller's channels, says which the app is in, and keeps channels someone else picked", async () => {
    const { request, factory, projects } = await settingsApp();
    await projects.update({
      orgId: 'org-1',
      id: factory.id,
      input: { slackToolSettings: { channels: 'selected', channelIds: ['C7'] } },
    });

    const { body } = await request('GET', path(factory.id));

    expect(body.linked).toBe(true);
    expect(body.channels).toEqual([
      { id: 'C2', name: 'eng', isPrivate: false, appIsMember: true },
      { id: 'G3', name: 'finance', isPrivate: true, appIsMember: true },
      { id: 'C7', name: 'ops', isPrivate: false, appIsMember: true },
      { id: 'C5', name: 'random', isPrivate: false, appIsMember: false },
    ]);
  });

  it('saves the settings, and the next read returns them', async () => {
    const { request, factory } = await settingsApp();
    const settings = { channels: 'selected', channelIds: ['C2', 'G3', 'C2'], channelAccess: 'read', directMessages: 'linked' };

    const saved = await request('PUT', path(factory.id), settings);

    expect(saved).toEqual({
      status: 200,
      body: { settings: { ...settings, channelIds: ['C2', 'G3'] } },
    });
    expect((await request('GET', path(factory.id))).body.settings).toEqual({ ...settings, channelIds: ['C2', 'G3'] });
  });

  it('refuses settings it would not understand, without saving anything', async () => {
    const { request, factory } = await settingsApp();

    for (const bad of [
      { channels: 'everything', channelIds: [], channelAccess: 'post', directMessages: 'anyone' },
      { channels: 'selected', channelIds: ['#eng'], channelAccess: 'post', directMessages: 'anyone' },
      { channels: 'selected', channelIds: [], channelAccess: 'post' },
    ]) {
      expect((await request('PUT', path(factory.id), bad)).status).toBe(400);
    }
    expect((await request('GET', path(factory.id))).body.settings.channels).toBe('session');
  });

  it("is closed to signed-out callers and to another organization's Factory", async () => {
    const { request, factory, otherOrgFactory } = await settingsApp();
    const settings = { channels: 'all', channelIds: [], channelAccess: 'post', directMessages: 'anyone' };

    expect((await request('GET', path(factory.id), undefined, 'none')).status).toBe(401);
    expect((await request('PUT', path(otherOrgFactory.id), settings)).status).toBe(404);
    expect((await request('GET', path(otherOrgFactory.id))).status).toBe(404);
    expect((await request('PUT', path(factory.id), settings, 'user-2:org-2')).status).toBe(404);
  });

  it('adds the app to a public channel', async () => {
    const { request, factory } = await settingsApp();

    const { status } = await request('POST', `${path(factory.id)}/channels/C5/join`);

    expect(status).toBe(200);
    expect(calls.filter(call => call.method === 'conversations.join').map(call => call.args.channel)).toEqual(['C5']);
  });

  it("explains why the app couldn't join: missing permission, or a private channel", async () => {
    const { request, factory } = await settingsApp();

    joinError = 'missing_scope';
    expect(await request('POST', `${path(factory.id)}/channels/C5/join`)).toEqual({
      status: 409,
      body: {
        error: 'missing_scope',
        message: 'The Slack app needs the channels:join permission. Reinstall the app to add it.',
      },
    });

    joinError = 'method_not_supported_for_channel_type';
    expect((await request('POST', `${path(factory.id)}/channels/G3/join`)).body.message).toMatch(/run \/invite/);
  });

  it("won't try to join without a channel id or a connected Slack account", async () => {
    const linked = await settingsApp();
    expect((await linked.request('POST', `${path(linked.factory.id)}/channels/general/join`)).status).toBe(400);

    const unlinked = await settingsApp({ linked: false });
    expect((await unlinked.request('POST', `${path(unlinked.factory.id)}/channels/C5/join`)).status).toBe(409);
    expect(calls.filter(call => call.method === 'conversations.join')).toEqual([]);
  });
});
