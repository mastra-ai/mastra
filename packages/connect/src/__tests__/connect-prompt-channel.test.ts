import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { AgentChannels } from '@mastra/core/channels';
import { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __clearSharedToolsStateForTests, tools as connect } from '../tools.js';

const PROJECT_ID = 'proj_1';
const CONNECT_URL = 'https://connect.example/linear?session_token=secret-session-token';
const TOOL_CALL_ID = 'call-connect-1';

const alice = { userId: 'U-ALICE', userName: 'alice', fullName: 'Alice', isBot: false, isMe: false };
const bob = { userId: 'U-BOB', userName: 'bob', fullName: 'Bob', isBot: false, isMe: false };

type Row = {
  id: string;
  integrationId: string;
  status: string;
  resourceId: string | null;
  connectedByUserId: null;
  connectedAt: null;
  createdAt: string;
  accountLabel: null;
};

/**
 * Mastra Platform with a Linear catalog entry. Connect sessions add a pending,
 * resource-owned row; the launch gate serves its link only under that
 * resource's assertion, as the platform does.
 */
function fakePlatform(options: { expiresAt?: string; sessionsFail?: boolean } = {}) {
  const rows: Row[] = [];
  const calls: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const asserted = (init?.headers as Record<string, string> | undefined)?.['x-mastra-resource-id'];
    calls.push(`${method} ${url.pathname}`);
    if (url.pathname === '/v2/integrations') {
      return Response.json({
        integrations: [{ id: 'linear', capabilities: {}, displayName: 'Linear', authType: 'OAUTH2' }],
      });
    }
    if (url.pathname === `/v2/projects/${PROJECT_ID}/integration-settings`) {
      return Response.json({ endUserProviders: null });
    }
    if (url.pathname === `/v2/projects/${PROJECT_ID}/connections`) {
      const resourceId = url.searchParams.get('resourceId');
      return Response.json({
        connections: rows.filter(row => row.resourceId === null || row.resourceId === resourceId),
      });
    }
    if (url.pathname === `/v2/projects/${PROJECT_ID}/integrations/linear/connect-sessions` && method === 'POST') {
      if (options.sessionsFail) return Response.json({ error: 'connection limit reached' }, { status: 409 });
      const { resourceId } = JSON.parse(String(init?.body)) as { resourceId: string };
      const id = `c_${rows.length + 1}`;
      rows.push({
        id,
        integrationId: 'linear',
        status: 'pending',
        resourceId,
        connectedByUserId: null,
        connectedAt: null,
        createdAt: '2026-11-26T00:00:00Z',
        accountLabel: null,
      });
      return Response.json({
        connectionId: id,
        integrationId: 'linear',
        connectUrl: null,
        sessionToken: null,
        expiresAt: options.expiresAt ?? '2099-01-01T00:00:00Z',
      });
    }
    const launch = /^\/v2\/connections\/([^/]+)\/connect-url$/.exec(url.pathname);
    if (launch) {
      const row = rows.find(candidate => candidate.id === launch[1]);
      if (!row || row.status !== 'pending' || row.resourceId !== asserted) return new Response(null, { status: 404 });
      return Response.json({ connectUrl: CONNECT_URL, expiresAt: options.expiresAt ?? '2099-01-01T00:00:00Z' });
    }
    return new Response(null, { status: 404 });
  });
  return {
    rows,
    calls,
    sessionsCreated: () => calls.filter(call => call.endsWith('/connect-sessions')).length,
    connectionListings: () => calls.filter(call => call === `GET /v2/projects/${PROJECT_ID}/connections`).length,
    settle: (status: 'active' | 'failed') => {
      for (const row of rows) row.status = status;
    },
    client: {
      accessToken: 'fake-test-token',
      baseUrl: 'https://platform.test',
      fetch: fetch as typeof globalThis.fetch,
    },
  };
}

/** Model that calls `request_connection` for Linear, then repeats the tool's message. */
function connectingModel() {
  const prompts: unknown[] = [];
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const toolResult = prompt
        .flatMap(message => (Array.isArray(message.content) ? message.content : []))
        .find(part => part.type === 'tool-result') as { output: { value: { message?: string } } } | undefined;
      const chunks = toolResult
        ? [
            { type: 'text-start' as const, id: 't' },
            { type: 'text-delta' as const, id: 't', delta: `Tool said: ${toolResult.output.value.message}` },
            { type: 'text-end' as const, id: 't' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ]
        : [
            {
              type: 'tool-call' as const,
              toolCallId: TOOL_CALL_ID,
              toolName: 'request_connection',
              input: '{"provider":"linear"}',
              providerExecuted: false,
            },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start' as const, warnings: [] }, ...chunks]),
      };
    },
  });
  return { model, prompts };
}

type Recorded = {
  kind: 'post' | 'edit' | 'ephemeral';
  threadId: string;
  messageId?: string;
  userId?: string;
  body: string;
};

/** A Slack-like adapter that records every message; `ephemeral` picks how private delivery behaves. */
function recordingAdapter(ephemeral: 'native' | 'unsupported' | 'throws') {
  const recorded: Recorded[] = [];
  let posts = 0;
  const adapter: Record<string, unknown> = {
    name: 'slack',
    userName: 'Bot',
    isDM: () => false,
    postMessage: async (threadId: string, message: unknown) => {
      const id = `msg-${++posts}`;
      recorded.push({ kind: 'post', threadId, messageId: id, body: JSON.stringify(message) });
      return { id, threadId, text: '' };
    },
    editMessage: async (threadId: string, messageId: string, message: unknown) => {
      recorded.push({ kind: 'edit', threadId, messageId, body: JSON.stringify(message) });
      return { id: messageId };
    },
    deleteMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    handleWebhook: async () => new Response('ok'),
    initialize: async () => {},
    fetchMessages: async () => ({ messages: [] }),
    encodeThreadId: (...parts: string[]) => parts.join(':'),
    decodeThreadId: (id: string) => id.split(':'),
    channelIdFromThreadId: (id: string) => id.split(':')[0],
    renderFormatted: (text: string) => text,
    fetchThread: async () => null,
    startTyping: async () => {},
    parseMessage: (raw: unknown) => raw,
  };
  if (ephemeral !== 'unsupported') {
    adapter.postEphemeral = async (threadId: string, userId: string, message: unknown) => {
      if (ephemeral === 'throws') throw new Error('ephemeral messages are not supported here');
      recorded.push({ kind: 'ephemeral', threadId, userId, body: JSON.stringify(message) });
      return { id: `eph-${recorded.length}`, threadId, usedFallback: false, raw: {} };
    };
  }
  return { adapter, recorded };
}

/** Button actions on a recorded card body, in order. */
function actionsOf(body: string): string[] {
  return Array.from(body.matchAll(new RegExp(`tool_resume:${TOOL_CALL_ID}:([a-z]+)`, 'g')), match => match[1]!);
}

async function setup(
  options: {
    ephemeral?: 'native' | 'unsupported' | 'throws';
    expiresAt?: string;
    /** Scope the toolset to whoever the channel says is acting, as a per-request resolver might. */
    scopeToActor?: boolean;
    sessionsFail?: boolean;
    /** Who may click; defaults to anyone so the connect tool's own ownership check is under test. */
    toolApprovers?: 'anyone' | 'requester';
  } = {},
) {
  const platform = fakePlatform({ expiresAt: options.expiresAt, sessionsFail: options.sessionsFail });
  const resolveTools = options.scopeToActor
    ? connect({
        projectId: PROJECT_ID,
        client: platform.client,
        resourceId: ctx => {
          const channel = (ctx?.requestContext as RequestContext | undefined)?.get('channel') as
            | { platform: string; userId: string }
            | undefined;
          return channel ? `${channel.platform}:${channel.userId}` : undefined;
        },
      })
    : connect({ projectId: PROJECT_ID, client: platform.client, resourceId: 'slack:U-ALICE' });
  const { model, prompts } = connectingModel();
  const agent = new Agent({
    id: 'connect-agent',
    name: 'Bot',
    instructions: 'Use Linear.',
    model,
    tools: options.scopeToActor ? ({ requestContext }) => resolveTools({ requestContext }) : await resolveTools(),
  });
  const { adapter, recorded } = recordingAdapter(options.ephemeral ?? 'native');
  // Anyone may click, so the tool's own ownership check is what stops Bob.
  const channels = new AgentChannels({
    adapters: {
      slack: { adapter: adapter as any, streaming: false, toolApprovers: options.toolApprovers ?? 'anyone' },
    },
  });
  agent.setChannels(channels);
  const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), agents: { agent } });
  await channels.initialize(mastra);
  const sdk = channels.sdk as any;
  const threadId = 'C1:1700000000.0001';

  const cards = () => recorded.filter(entry => entry.kind !== 'ephemeral' && actionsOf(entry.body).length > 0);
  /** The actions on the latest version of the connect card. */
  const shownActions = () => actionsOf(cards().at(-1)?.body ?? '');
  const cardMessageId = () => cards()[0]!.messageId!;
  const replies = () =>
    recorded.filter(entry => entry.kind === 'post' && entry.body.includes('Tool said')).map(entry => entry.body);

  const click = async (action: string, user = alice) => {
    const before = recorded.length;
    await sdk.processAction({
      actionId: `tool_resume:${TOOL_CALL_ID}:${action}`,
      adapter,
      messageId: cardMessageId(),
      threadId,
      thread: { id: threadId, channelId: 'C1', isDM: false },
      user,
      raw: {},
    });
    // Wait for the resumed call to show its next card or reply.
    await vi.waitFor(
      () =>
        expect(
          recorded
            .slice(before)
            .some(
              entry =>
                (entry.kind !== 'ephemeral' && actionsOf(entry.body).length > 0) || entry.body.includes('Tool said'),
            ),
        ).toBe(true),
      { timeout: 5000 },
    );
  };

  await sdk.processMessage(adapter, threadId, {
    id: 'in-1',
    threadId,
    text: '@Bot list my Linear issues',
    formatted: { type: 'root', children: [] },
    raw: {},
    attachments: [],
    author: alice,
    metadata: { dateSent: new Date(), edited: false },
  });
  await vi.waitFor(() => expect(shownActions()).toEqual(['connect', 'cancel']), { timeout: 5000 });

  return { platform, recorded, resolveTools, prompts, shownActions, replies, click, cards, agent };
}

/** Every message other members of the thread can see. */
function publicBodies(recorded: Recorded[]) {
  return recorded.filter(entry => entry.kind !== 'ephemeral').map(entry => entry.body);
}

afterEach(async () => {
  await __clearSharedToolsStateForTests();
});

describe('request_connection in a channel thread', () => {
  it('shows a Connect and Cancel card instead of leaving the thread stuck', async () => {
    const t = await setup();
    const card = t.cards().at(-1)!.body;
    expect(card).toContain('Connect **Linear** to continue.');
    expect(card).toContain('Connect Linear');
    expect(t.platform.sessionsCreated()).toBe(0);
    expect(t.prompts).toHaveLength(1);
  });

  it('sends the sign-in link to the clicker only, then waits for them to connect', async () => {
    const t = await setup();
    await t.click('connect');

    const ephemerals = t.recorded.filter(entry => entry.kind === 'ephemeral');
    expect(ephemerals).toEqual([
      expect.objectContaining({ userId: alice.userId, body: expect.stringContaining(CONNECT_URL) }),
    ]);
    expect(
      publicBodies(t.recorded).filter(
        body => body.includes('connect.example') || body.includes('secret-session-token'),
      ),
    ).toEqual([]);
    expect(t.shownActions()).toEqual(['check', 'cancel']);
    expect(t.cards().at(-1)!.body).toContain('I sent you a private link to connect Linear.');
    expect(t.platform.sessionsCreated()).toBe(1);
    expect(t.prompts).toHaveLength(1);
  });

  it.each(['unsupported', 'throws'] as const)(
    'tells the user to connect from the app when the link cannot be sent privately (%s)',
    async ephemeral => {
      const t = await setup({ ephemeral });
      await t.click('connect');

      expect(t.cards().at(-1)!.body).toContain("I couldn't send you a private link. Connect Linear from the app");
      expect(t.shownActions()).toEqual(['check', 'cancel']);
      expect(publicBodies(t.recorded).filter(body => body.includes('connect.example'))).toEqual([]);
    },
  );

  it('starts no sign-in when someone other than the conversation owner clicks Connect', async () => {
    const t = await setup();
    await t.click('connect', bob);

    expect(t.platform.sessionsCreated()).toBe(0);
    expect(t.recorded.filter(entry => entry.kind === 'ephemeral')).toEqual([
      expect.objectContaining({
        userId: bob.userId,
        body: expect.stringContaining('Only the person this conversation belongs to can connect an account here.'),
      }),
    ]);
    expect(t.shownActions()).toEqual(['connect', 'cancel']);

    // The owner can still connect afterwards.
    await t.click('connect');
    expect(t.platform.sessionsCreated()).toBe(1);
    expect(t.shownActions()).toEqual(['check', 'cancel']);
  });

  it("starts no sign-in for someone else even when the toolset follows the channel's actor", async () => {
    const t = await setup({ scopeToActor: true });
    await t.click('connect', bob);

    expect(t.platform.sessionsCreated()).toBe(0);
    expect(t.shownActions()).toEqual(['connect', 'cancel']);

    await t.click('connect');
    expect(t.platform.sessionsCreated()).toBe(1);
    expect(t.shownActions()).toEqual(['check', 'cancel']);
  });

  it("still knows the sign-in after I've connected was pressed too early", async () => {
    const t = await setup();
    await t.click('connect');
    await t.click('check');
    t.platform.settle('failed');
    await t.click('check');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear could not be connected: The sign-in did not finish.');
  });

  it('tells the user to connect from the app when the platform cannot start a sign-in', async () => {
    const t = await setup({ sessionsFail: true });
    await t.click('connect');

    expect(t.cards().at(-1)!.body).toContain("I couldn't send you a private link. Connect Linear from the app");
    expect(t.shownActions()).toEqual(['check', 'cancel']);
    expect(t.recorded.filter(entry => entry.kind === 'ephemeral')).toEqual([]);
  });

  it("ignores the undelivered link's expiry once the user was told to connect from the app", async () => {
    const t = await setup({ ephemeral: 'unsupported', expiresAt: '2000-01-01T00:00:00Z' });
    await t.click('connect');
    await t.click('check');

    expect(t.cards().at(-1)!.body).toContain("Linear isn't connected yet.");
    expect(t.shownActions()).toEqual(['check', 'cancel']);
    expect(t.replies()).toEqual([]);
  });

  it('finishes once the user connected from the app after the link could not be sent', async () => {
    const t = await setup({ ephemeral: 'unsupported' });
    await t.click('connect');
    t.platform.rows.push({
      id: 'c_app',
      integrationId: 'linear',
      status: 'active',
      resourceId: 'slack:U-ALICE',
      connectedByUserId: null,
      connectedAt: null,
      createdAt: '2026-11-26T00:00:00Z',
      accountLabel: null,
    });
    await t.click('check');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear connected successfully.');
  });

  it('keeps the sign-in link out of the paused call, its result and what the model sees', async () => {
    const t = await setup();
    await t.click('connect');
    const paused = await t.agent.listSuspendedRuns({});
    expect(paused.runs).toHaveLength(1);
    const pausedPayload = JSON.stringify(paused.runs[0]!.toolCalls);
    expect(pausedPayload).toContain('"connectionId"');
    expect(pausedPayload).not.toContain('connect.example');
    expect(pausedPayload).not.toContain('secret-session-token');

    t.platform.settle('active');
    await t.click('check');
    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    const seenByModel = JSON.stringify(t.prompts);
    expect(seenByModel).toContain('Linear connected successfully.');
    expect(seenByModel).not.toContain('connect.example');
    expect(seenByModel).not.toContain('secret-session-token');
  });

  it('lets the owner connect when only the requester may answer cards', async () => {
    const t = await setup({ toolApprovers: 'requester' });
    await t.click('connect');

    expect(t.platform.sessionsCreated()).toBe(1);
    expect(t.shownActions()).toEqual(['check', 'cancel']);
  });

  it("keeps waiting when I've connected is pressed before the sign-in finished", async () => {
    const t = await setup();
    await t.click('connect');
    await t.click('check');

    expect(t.cards().at(-1)!.body).toContain("Linear isn't connected yet.");
    expect(t.shownActions()).toEqual(['check', 'cancel']);
    expect(t.prompts).toHaveLength(1);
  });

  it("finishes the call once the user connected and pressed I've connected", async () => {
    const t = await setup();
    await t.click('connect');
    t.platform.settle('active');
    await t.click('check');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear connected successfully.');
    expect(t.prompts).toHaveLength(2);
  });

  it('tells tool resolutions the new connection is active right away', async () => {
    const t = await setup();
    await t.click('connect');
    t.platform.settle('active');
    // The resolver's snapshot was taken before the user connected.
    await t.resolveTools();
    const before = t.platform.connectionListings();
    await t.click('check');
    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));

    const listingsByTheCall = t.platform.connectionListings() - before;
    await t.resolveTools();
    // Without being told, the resolver would keep serving its cached snapshot.
    expect(t.platform.connectionListings() - before).toBe(listingsByTheCall + 1);
  });

  it('fails the call when the sign-in failed', async () => {
    const t = await setup();
    await t.click('connect');
    t.platform.settle('failed');
    await t.click('check');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear could not be connected: The sign-in did not finish.');
  });

  it('fails the call when the sign-in link expired', async () => {
    const t = await setup({ expiresAt: '2020-01-01T00:00:00Z' });
    await t.click('connect');
    await t.click('check');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear could not be connected: The sign-in link expired.');
  });

  it.each([[[] as string[]], [['connect']]])('finishes the call as cancelled on Cancel (after %j)', async before => {
    const t = await setup();
    for (const action of before) await t.click(action);
    await t.click('cancel');

    await vi.waitFor(() => expect(t.replies()).toHaveLength(1));
    expect(t.replies()[0]).toContain('Tool said: Linear could not be connected: The user cancelled connecting.');
  });
});
