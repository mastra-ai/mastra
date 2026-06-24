import { createHmac } from 'node:crypto';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Hono } from '@emulators/core';
import { createSlackAdapter } from '@chat-adapter/slack';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlackProvider } from './provider';
import { startSlackEmulator, type SlackEmulator } from './__tests__/slack-emulator';

/**
 * AgentChannels end-to-end against the in-process Slack emulator (no network, no Docker).
 *
 * Drives a real agent through `AgentChannels` for an inbound Slack `message` event and asserts the
 * agent's reply is posted back to the emulator via `chat.postMessage`. Exercises the channels
 * orchestration shipped in #17832 (owner stream → output processor → `waitUntil`) over a real HTTP
 * surface, then asserts parity between two activation paths:
 *
 *   - Path A: a `SlackProvider`-activated adapter (OAuth install → signed `/slack/events/:id`).
 *   - Path B: a directly-configured `createSlackAdapter` on the agent (`handleWebhookEvent`).
 *
 * Both must land an equivalent message (channel, thread_ts, text) in the emulator store.
 */
describe('AgentChannels e2e (emulator)', () => {
  let emulator: SlackEmulator;

  const AGENT_ID = 'support-agent';
  const REPLY_TEXT = 'Hello from the agent';

  beforeEach(async () => {
    emulator = await startSlackEmulator(
      {
        team: { name: 'Acme', domain: 'acme' },
        users: [{ name: 'installer', real_name: 'Installer', is_admin: true }],
        channels: [{ name: 'general' }],
      },
      { registerManifestRoutes: true },
    );
  });

  afterEach(async () => {
    await emulator.close();
  });

  /** Mock model that streams a fixed reply through the v5 stream protocol. */
  function makeModel() {
    return new MockLanguageModelV2({
      modelId: 'mock-reply-model',
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-reply-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: REPLY_TEXT },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      }),
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        content: [{ type: 'text', text: REPLY_TEXT }],
      }),
    });
  }

  /** Sign a request body the way Slack does so the provider's signature check passes. */
  function signSlackBody(signingSecret: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
    return { timestamp, signature };
  }

  /**
   * Build an inbound Slack `app_mention` `event_callback` envelope.
   *
   * The channels chat SDK only runs the agent for mentions, DMs, or already-subscribed threads —
   * a plain channel `message` event is intentionally ignored (bots don't reply to every message).
   * Mentioning the bot routes the event to AgentChannels' `onNewMention` handler.
   */
  function inboundMessage(params: { channel: string; user: string; botUserId: string; text: string; ts: string }) {
    return JSON.stringify({
      type: 'event_callback',
      team_id: 'T000000001',
      api_app_id: 'A000000001',
      event: {
        type: 'app_mention',
        channel: params.channel,
        channel_type: 'channel',
        user: params.user,
        text: `<@${params.botUserId}> ${params.text}`,
        ts: params.ts,
      },
    });
  }

  /**
   * A `waitUntil` collector: the channels path may hand the agent run off to `waitUntil` instead
   * of awaiting it inline. We capture those promises so the test can await full completion before
   * asserting on the emulator's message store.
   */
  function waitUntilCollector() {
    const pending: Promise<unknown>[] = [];
    return {
      waitUntil: (p: Promise<unknown>) => {
        pending.push(p);
      },
      settle: async () => {
        await Promise.allSettled(pending);
      },
    };
  }

  /** Normalize a posted message for cross-path parity comparison. */
  function normalize(msg: { channel_id?: string; text?: string; thread_ts?: string }) {
    return { channel: msg.channel_id, text: msg.text, thread_ts: msg.thread_ts ?? null };
  }

  /**
   * Poll the emulator's message store until the agent's reply lands in the channel.
   *
   * The channels orchestration from #17832 returns the inbound webhook fast and continues the agent
   * run on a background task (owner stream / `waitUntil`), so the reply arrives asynchronously after
   * the webhook response resolves.
   */
  async function waitForReply(channelId: string, predicate: (text: string) => boolean, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const match = emulator.slackStore.messages
        .all()
        .find(m => m.channel_id === channelId && typeof m.text === 'string' && predicate(m.text));
      if (match) return match;
      await new Promise(r => setTimeout(r, 25));
    }
    return undefined;
  }

  /** Run a full OAuth install and return the active installation. */
  async function installViaProvider(collector: ReturnType<typeof waitUntilCollector>) {
    const agent = new Agent({
      id: AGENT_ID,
      name: 'Support Agent',
      instructions: 'You help users.',
      model: makeModel() as never,
    });
    const mastra = new Mastra({
      agents: { support: agent },
      storage: new InMemoryStore() as never,
    });
    const provider = new SlackProvider({
      apiUrl: `${emulator.url}/api`,
      baseUrl: emulator.url,
      refreshToken: 'xoxe-1-test-refresh-token',
      token: 'xoxe.xoxp-test-config-token',
      // Capture agent runs handed off via waitUntil so the test can await them.
      waitUntil: collector.waitUntil,
    });
    provider.__attach(mastra);

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

    const callbackApp = new Hono();
    const callbackRoute = provider.getRoutes().find(r => r.path === '/slack/oauth/callback')!;
    callbackApp.get(callbackRoute.path, async c => {
      const handler = await callbackRoute.createHandler({ mastra } as never);
      return (handler as (ctx: unknown) => Promise<Response>)(c);
    });
    const res = await callbackApp.request(`/slack/oauth/callback?${new URLSearchParams({ code, state })}`);
    expect(res.status).toBe(302);

    const installation = await provider.getInstallation(AGENT_ID);
    expect(installation).not.toBeNull();

    // The OAuth flow minted a fresh bot token in the emulator store; authorize it so the adapter's
    // Web API calls (chat.postMessage) succeed against the emulator auth middleware.
    emulator.syncBotTokens();

    return { provider, mastra, installation: installation! };
  }

  /**
   * Path A: drive an inbound mention through a `SlackProvider`-activated adapter (full OAuth
   * install → signed `POST /slack/events/:webhookId`). Returns the posted reply message.
   */
  async function runPathA(ts: string) {
    const collector = waitUntilCollector();
    const { provider, mastra, installation } = await installViaProvider(collector);

    const channel = emulator.slackStore.channels.all()[0];
    const user = emulator.slackStore.users.all()[0];
    const body = inboundMessage({
      channel: channel.channel_id,
      user: user.user_id,
      botUserId: installation.botUserId,
      text: 'help me',
      ts,
    });
    const { timestamp, signature } = signSlackBody(installation.signingSecret, body);

    // Mount the provider's events route and POST a signed Slack event_callback.
    const eventsApp = new Hono();
    const eventsRoute = provider.getRoutes().find(r => r.path === '/slack/events/:webhookId')!;
    eventsApp.post(eventsRoute.path, async c => {
      const handler = await eventsRoute.createHandler({ mastra } as never);
      return (handler as (ctx: unknown) => Promise<Response>)(c);
    });

    const response = await eventsApp.request(`/slack/events/${installation.webhookId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
      body,
    });
    expect(response.status).toBe(200);

    await collector.settle();

    const reply = await waitForReply(channel.channel_id, t => t.includes(REPLY_TEXT));
    expect(reply, 'agent reply should be posted to the channel').toBeDefined();
    return reply!;
  }

  /**
   * Path B: drive an inbound mention through a directly-configured `createSlackAdapter` on the
   * agent (`getChannels().handleWebhookEvent`). Returns the posted reply message.
   */
  async function runPathB(ts: string) {
    const collector = waitUntilCollector();

    // Seed a bot token + the adapter pointed at the emulator.
    const botToken = 'xoxb-direct-path-token';
    emulator.slackStore.tokens.insert({
      token: botToken,
      token_type: 'bot',
      team_id: 'T000000001',
      user_id: 'U000000001',
      bot_user_id: 'U000000001',
      scopes: ['chat:write', 'channels:read'],
    } as never);
    emulator.tokenMap.set(botToken, { login: 'U000000001', id: 1, scopes: ['chat:write', 'channels:read'] });

    const signingSecret = 'direct-signing-secret';
    const adapter = createSlackAdapter({
      apiUrl: `${emulator.url}/api`,
      botToken,
      botUserId: 'U000000001',
      signingSecret,
    });

    const agent = new Agent({
      id: `${AGENT_ID}-direct`,
      name: 'Support Agent',
      instructions: 'You help users.',
      model: makeModel() as never,
      channels: { adapters: { slack: adapter } } as never,
    });
    const mastra = new Mastra({
      agents: { supportDirect: agent },
      storage: new InMemoryStore() as never,
    });

    const channels = agent.getChannels();
    expect(channels, 'agent should auto-create AgentChannels from channels config').not.toBeNull();
    await channels!.initialize(mastra);

    const channel = emulator.slackStore.channels.all()[0];
    const user = emulator.slackStore.users.all()[0];
    const body = inboundMessage({
      channel: channel.channel_id,
      user: user.user_id,
      botUserId: 'U000000001',
      text: 'help me',
      ts,
    });
    const { timestamp, signature } = signSlackBody(signingSecret, body);

    const request = new Request(`${emulator.url}/slack/events/direct`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
      body,
    });

    const response = await channels!.handleWebhookEvent('slack', request, { waitUntil: collector.waitUntil });
    expect(response.status).toBe(200);

    await collector.settle();

    const reply = await waitForReply(channel.channel_id, t => t.includes(REPLY_TEXT));
    expect(reply, 'agent reply should be posted to the channel').toBeDefined();
    return reply!;
  }

  it('Path A: SlackProvider-activated adapter posts the agent reply to the emulator', async () => {
    const ts = '1700000000.000100';
    const reply = await runPathA(ts);
    expect(reply.text).toContain(REPLY_TEXT);
    // Reply is threaded under the inbound mention.
    expect(reply.thread_ts).toBe(ts);
  });

  it('Path B: directly-configured createSlackAdapter posts the agent reply to the emulator', async () => {
    const ts = '1700000000.000200';
    const reply = await runPathB(ts);
    expect(reply.text).toContain(REPLY_TEXT);
    expect(normalize(reply)).toEqual({
      channel: emulator.slackStore.channels.all()[0].channel_id,
      text: reply.text,
      thread_ts: ts,
    });
  });

  it('parity: both activation paths post an equivalent reply', async () => {
    const ts = '1700000000.000300';
    const replyA = await runPathA(ts);
    const replyB = await runPathB(ts);
    // Same channel, same threaded ts, same reply text — the SlackProvider seam and the direct
    // adapter drive the channels orchestration identically.
    expect(normalize(replyA)).toEqual(normalize(replyB));
  });
});
