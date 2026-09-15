import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { channelThreadCoordinates, createFactoryHandoffTool, handOffSlackThread } from './handoff-tool.js';
import type { HandoffDeps } from './handoff-tool.js';

const OLD_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
});

function requestContextFor(
  overrides: { orgId?: string; threadId?: string | null; factoryProjectId?: string | undefined } = {},
) {
  const { orgId = 'org-1', threadId = 'thread-old', factoryProjectId = 'fp-1' } = overrides;
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1', organizationId: orgId });
  requestContext.set('controller', {
    threadId,
    resourceId: 'us-old',
    getState: () =>
      'factoryProjectId' in overrides ? { factoryProjectId: overrides.factoryProjectId } : { factoryProjectId },
  });
  return requestContext;
}

function makeDeps({
  metadata = {
    channel_platform: 'slack',
    channel_externalThreadId: 'slack:C-1:1700.42',
    channel_externalChannelId: 'C-1',
  } as Record<string, unknown> | undefined,
  target = { id: 'fp-2', name: 'Web', slackWorkItemsEnabled: false } as any,
  hasRepo = true,
  existingCard = null as any,
} = {}) {
  const session = { sendMessage: vi.fn().mockResolvedValue(undefined) };
  const slackThread = { post: vi.fn().mockResolvedValue({}) };
  const channels = {
    rebindThread: vi.fn().mockResolvedValue({ previous: { id: 'thread-old' }, thread: { id: 'us-web' } }),
    getSessionForThread: vi.fn().mockResolvedValue(session),
    sdk: { thread: vi.fn(() => slackThread) },
  };
  const sourceControl = {
    connections: { list: vi.fn().mockResolvedValue([{ id: 'conn-web', integrationId: 'github' }]) },
    projectRepositories: {
      list: vi.fn().mockResolvedValue(hasRepo ? [{ id: 'pr-web', repositoryId: 'repo-web' }] : []),
    },
    repositories: { get: vi.fn().mockResolvedValue({ defaultBranch: 'main', slug: 'acme/web' }) },
    sessions: {
      getBySessionId: vi.fn().mockResolvedValue({ sessionId: 'us-old', visibility: 'private' }),
      getForBranch: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ sessionId: 'us-web' }),
    },
    integrationId: 'github',
  };
  const workItems = {
    getBySource: vi.fn().mockResolvedValue(existingCard),
    upsert: vi.fn().mockResolvedValue({}),
  };
  const feed = { createComment: vi.fn().mockResolvedValue({ status: 'created' }) };
  const deps = {
    channels: () => channels,
    threads: async () => ({ getThreadById: vi.fn().mockResolvedValue(metadata ? { metadata } : null) }),
    accountLinks: { getAccountLink: vi.fn() },
    projects: { get: vi.fn(async ({ id }: { id: string }) => (id === target?.id ? target : null)) },
    sourceControl,
    workItems,
    feed,
  } as unknown as HandoffDeps;
  return { deps, channels, session, slackThread, sourceControl, workItems, feed };
}

describe('channelThreadCoordinates', () => {
  it('reads the channel coordinates core stamps on a thread', () => {
    expect(
      channelThreadCoordinates({
        channel_platform: 'slack',
        channel_externalThreadId: 'slack:C-1:1',
        channel_externalChannelId: 'C-1',
        channel_ownerId: 'agent',
      }),
    ).toEqual({ platform: 'slack', externalThreadId: 'slack:C-1:1', channelId: 'C-1' });
    expect(channelThreadCoordinates({ channel_platform: 'slack' })).toBeUndefined();
    expect(channelThreadCoordinates(null)).toBeUndefined();
  });
});

describe('handOffSlackThread', () => {
  const input = {
    factoryProjectId: 'fp-2',
    factoryName: 'Web',
    summary: 'Rename the Header component. Found src/Header.tsx in acme/web.',
  };

  it('creates the target session, rebinds the thread, posts the card, and wakes the new session', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const { deps, channels, session, slackThread, sourceControl } = makeDeps();

    const result = await handOffSlackThread(deps, requestContextFor(), input);

    expect(result).toEqual({
      status: 'handed_off',
      factoryName: 'Web',
      sessionId: 'us-web',
      url: 'https://mc.example.com/factories/fp-2/workspaces/us-web/threads/us-web',
      started: true,
    });
    expect(sourceControl.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', userId: 'user-1', branch: 'slack/1700-42', visibility: 'private' }),
    );
    expect(channels.rebindThread).toHaveBeenCalledWith({
      platform: 'slack',
      externalThreadId: 'slack:C-1:1700.42',
      channelId: 'C-1',
      resourceId: 'us-web',
      threadId: 'us-web',
    });
    expect(channels.sdk.thread).toHaveBeenCalledWith('slack:C-1:1700.42');
    expect(slackThread.post.mock.calls[0]![0]).toMatchObject({ title: 'Continuing in Web' });
    expect(channels.getSessionForThread).toHaveBeenCalledWith(
      { id: 'us-web', resourceId: 'us-web' },
      expect.anything(),
    );
    const [{ content, requestContext }] = session.sendMessage.mock.calls[0]!;
    expect(content).toContain('handed to the Web factory');
    expect(content).toContain(input.summary);
    expect(requestContext.get('user')).toEqual({ id: 'user-1', organizationId: 'org-1' });
    expect(requestContext.get('controller')).toBeUndefined();
  });

  it('reuses an existing session on the thread branch', async () => {
    const { deps, sourceControl } = makeDeps();
    sourceControl.sessions.getForBranch.mockResolvedValue({ sessionId: 'us-existing' });

    const result = await handOffSlackThread(deps, requestContextFor(), input);

    expect(result).toMatchObject({ sessionId: 'us-existing' });
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    ['same factory', { deps: makeDeps().deps, ctx: requestContextFor({ factoryProjectId: 'fp-2' }) }],
    ['no org', { deps: makeDeps().deps, ctx: requestContextFor({ orgId: '' }) }],
    ['no thread', { deps: makeDeps().deps, ctx: requestContextFor({ threadId: null }) }],
    [
      'not a Slack thread',
      { deps: makeDeps({ metadata: { channel_platform: 'discord' } }).deps, ctx: requestContextFor() },
    ],
    ['unknown factory', { deps: makeDeps({ target: null }).deps, ctx: requestContextFor() }],
    [
      'name does not match the id',
      {
        deps: makeDeps({ target: { id: 'fp-2', name: 'API', slackWorkItemsEnabled: false } }).deps,
        ctx: requestContextFor(),
      },
    ],
    ['target without a repository', { deps: makeDeps({ hasRepo: false }).deps, ctx: requestContextFor() }],
  ])('refuses without touching the thread: %s', async (_label, { deps, ctx }) => {
    const result = await handOffSlackThread(deps, ctx, input);
    expect(result.status).toBe('refused');
    expect((deps.channels() as any).rebindThread).not.toHaveBeenCalled();
  });

  it('notes the handoff on the previous card and files a card in the target when it wants Slack cards', async () => {
    const { deps, workItems, feed } = makeDeps({
      target: { id: 'fp-2', name: 'Web', slackWorkItemsEnabled: true },
      existingCard: { id: 'wi-old', externalSource: { workspaceId: 'T-1' } },
    });

    await handOffSlackThread(deps, requestContextFor(), input);

    expect(feed.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', workItemId: 'wi-old', body: 'Handed off to the Web factory.' }),
    );
    expect(workItems.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryProjectId: 'fp-2',
        input: expect.objectContaining({
          externalSource: expect.objectContaining({ workspaceId: 'T-1', externalId: 'slack:C-1:1700.42' }),
          sessions: { chat: { sessionId: 'us-web', branch: 'slack/1700-42', threadId: 'us-web' } },
        }),
      }),
    );
  });

  it('reports the rebind as done when the new session fails to start, and tells the thread', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { deps, channels, slackThread } = makeDeps();
    channels.getSessionForThread.mockRejectedValue(new Error('workspace down'));

    const result = await handOffSlackThread(deps, requestContextFor(), input);

    expect(result).toMatchObject({ status: 'handed_off', started: false, sessionId: 'us-web' });
    expect(channels.rebindThread).toHaveBeenCalledTimes(1);
    expect(slackThread.post).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Couldn't start the session in Web") }),
    );
    expect(warn).toHaveBeenCalled();
  });
});

describe('createFactoryHandoffTool', () => {
  it('is offered only to factory sessions with a thread and tenant', () => {
    const { deps } = makeDeps();
    expect(createFactoryHandoffTool(requestContextFor({ orgId: '' }), deps)).toEqual({});
    expect(createFactoryHandoffTool(requestContextFor({ threadId: null }), deps)).toEqual({});
    expect(createFactoryHandoffTool(requestContextFor({ factoryProjectId: undefined }), deps)).toEqual({});
    const tools = createFactoryHandoffTool(requestContextFor(), deps);
    expect(Object.keys(tools)).toEqual(['factory_handoff']);
  });

  it('requires a human approval before it executes', () => {
    const { deps } = makeDeps();
    const tools = createFactoryHandoffTool(requestContextFor(), deps) as {
      factory_handoff: { requireApproval?: boolean };
    };
    expect(tools.factory_handoff.requireApproval).toBe(true);
  });
});
