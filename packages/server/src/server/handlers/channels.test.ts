import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';

import { CONNECT_CHANNEL_ROUTE, DISCONNECT_CHANNEL_ROUTE } from './channels';

// =============================================================================
// Mock helpers
// =============================================================================

interface MockStoredAgent {
  id: string;
  authorId?: string | null;
  visibility?: 'private' | 'public';
}

function createMockAgentsStore(agents: Map<string, MockStoredAgent>) {
  return {
    getById: vi.fn().mockImplementation(async (id: string) => agents.get(id) ?? null),
  };
}

function createMockStorage(agentsStore: ReturnType<typeof createMockAgentsStore> | null) {
  return {
    getStore: vi.fn().mockImplementation(async (name: string) => (name === 'agents' ? agentsStore : null)),
  };
}

interface SlackChannelMock {
  id: 'slack';
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function createSlackChannel(): SlackChannelMock {
  return {
    id: 'slack',
    connect: vi
      .fn()
      .mockResolvedValue({ type: 'oauth', authorizationUrl: 'https://slack.example/auth', installationId: 'inst-1' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMastra(options: {
  storage?: ReturnType<typeof createMockStorage> | null;
  channels?: Record<string, SlackChannelMock>;
  registeredAgentIds?: string[];
}) {
  const registered = new Set(options.registeredAgentIds ?? []);
  return {
    getStorage: vi.fn().mockReturnValue(options.storage ?? null),
    channels: options.channels ?? {},
    getAgentById: vi.fn().mockImplementation((id: string) => (registered.has(id) ? { id } : undefined)),
  };
}

function createContext(mastra: ReturnType<typeof createMockMastra>): ServerContext {
  return {
    mastra: mastra as unknown as Mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

function asAuthenticatedUser(ctx: ServerContext, userId: string, permissions: string[] = []): ServerContext {
  ctx.requestContext.set(MASTRA_USER_KEY, { id: userId });
  ctx.requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  if (permissions.length > 0) {
    ctx.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  }
  return ctx;
}

// =============================================================================
// Tests
// =============================================================================

describe('Channel Handlers RBAC', () => {
  let storedAgents: Map<string, MockStoredAgent>;
  let agentsStore: ReturnType<typeof createMockAgentsStore>;
  let storage: ReturnType<typeof createMockStorage>;
  let slackChannel: SlackChannelMock;
  let mastra: ReturnType<typeof createMockMastra>;

  beforeEach(() => {
    storedAgents = new Map();
    storedAgents.set('agent-owned-by-alice', { id: 'agent-owned-by-alice', authorId: 'alice' });
    storedAgents.set('agent-public-by-alice', {
      id: 'agent-public-by-alice',
      authorId: 'alice',
      visibility: 'public',
    });
    storedAgents.set('agent-legacy-unowned', { id: 'agent-legacy-unowned', authorId: null });

    agentsStore = createMockAgentsStore(storedAgents);
    storage = createMockStorage(agentsStore);
    slackChannel = createSlackChannel();
    mastra = createMockMastra({
      storage,
      channels: { slack: slackChannel },
      registeredAgentIds: [
        'agent-owned-by-alice',
        'agent-public-by-alice',
        'agent-legacy-unowned',
        'code-defined-agent',
      ],
    });
  });

  describe('CONNECT_CHANNEL_ROUTE', () => {
    it('lets the owner connect their agent', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'alice');

      const result = await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-owned-by-alice', undefined);
      expect(result).toMatchObject({ type: 'oauth', installationId: 'inst-1' });
    });

    it('rejects a non-owner attempting to connect a private agent (404)', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      const error = await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      }).catch(e => e);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(404);
      expect(slackChannel.connect).not.toHaveBeenCalled();
    });

    it('rejects a non-owner even when the agent is marked public (write requires ownership)', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await expect(
        CONNECT_CHANNEL_ROUTE.handler({
          ...ctx,
          platform: 'slack',
          agentId: 'agent-public-by-alice',
          options: undefined,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(slackChannel.connect).not.toHaveBeenCalled();
    });

    it('allows a caller with agents:* admin bypass to connect any agent', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'admin', ['agents:*']);

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-owned-by-alice', undefined);
    });

    it('allows a caller with a scoped agents:edit:<id> permission', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory', ['agents:edit:agent-owned-by-alice']);

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-owned-by-alice', undefined);
    });

    it('treats legacy unowned stored agents as writable by any authenticated caller', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-legacy-unowned',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-legacy-unowned', undefined);
    });

    it('allows connecting a code-defined agent (no stored record) for any authenticated caller', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'anyone');

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'code-defined-agent',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('code-defined-agent', undefined);
    });

    it('skips ownership enforcement when auth is not configured (no user on context)', async () => {
      const ctx = createContext(mastra); // no MASTRA_USER_KEY / MASTRA_RESOURCE_ID_KEY

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-owned-by-alice', undefined);
    });

    it('still works when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({
        storage: null,
        channels: { slack: slackChannel },
        registeredAgentIds: ['agent-owned-by-alice'],
      });
      const ctx = asAuthenticatedUser(createContext(mastraNoStorage), 'mallory');

      await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
        options: undefined,
      });

      expect(slackChannel.connect).toHaveBeenCalledWith('agent-owned-by-alice', undefined);
    });

    it('returns 404 when the agent does not exist in the runtime registry', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'alice');

      const error = await CONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'no-such-agent',
        options: undefined,
      }).catch(e => e);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(404);
      expect(slackChannel.connect).not.toHaveBeenCalled();
    });
  });

  describe('DISCONNECT_CHANNEL_ROUTE', () => {
    it('lets the owner disconnect their agent', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'alice');

      const result = await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-owned-by-alice');
      expect(result).toEqual({ success: true });
    });

    it('rejects a non-owner attempting to disconnect a private agent (404)', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await expect(
        DISCONNECT_CHANNEL_ROUTE.handler({
          ...ctx,
          platform: 'slack',
          agentId: 'agent-owned-by-alice',
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(slackChannel.disconnect).not.toHaveBeenCalled();
    });

    it('rejects a non-owner even when the agent is marked public', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await expect(
        DISCONNECT_CHANNEL_ROUTE.handler({
          ...ctx,
          platform: 'slack',
          agentId: 'agent-public-by-alice',
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(slackChannel.disconnect).not.toHaveBeenCalled();
    });

    it('allows a caller with agents admin bypass to disconnect any agent', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'admin', ['agents:admin']);

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-owned-by-alice');
    });

    it('allows a caller with a scoped agents:edit:<id> permission', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory', ['agents:edit:agent-owned-by-alice']);

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-owned-by-alice');
    });

    it('treats legacy unowned stored agents as writable by any authenticated caller', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-legacy-unowned',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-legacy-unowned');
    });

    it('allows disconnecting a code-defined agent (no stored record) for any authenticated caller', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'anyone');

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'code-defined-agent',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('code-defined-agent');
    });

    it('skips ownership enforcement when auth is not configured (no user on context)', async () => {
      const ctx = createContext(mastra);

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-owned-by-alice');
    });

    it('still works when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({
        storage: null,
        channels: { slack: slackChannel },
        registeredAgentIds: ['agent-owned-by-alice'],
      });
      const ctx = asAuthenticatedUser(createContext(mastraNoStorage), 'mallory');

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      });

      expect(slackChannel.disconnect).toHaveBeenCalledWith('agent-owned-by-alice');
    });

    it('allows orphan disconnect for a caller with channels:write', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'alice', ['channels:write']);

      const result = await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'no-such-agent',
      });

      expect(result).toEqual({ success: true });
      expect(slackChannel.disconnect).toHaveBeenCalledWith('no-such-agent');
    });

    it('allows orphan disconnect for a caller with channels:* admin bypass', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'admin', ['channels:*']);

      const result = await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'no-such-agent',
      });

      expect(result).toEqual({ success: true });
      expect(slackChannel.disconnect).toHaveBeenCalledWith('no-such-agent');
    });

    it('rejects orphan disconnect for a caller without channels:write', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory', ['agents:read']);

      const error = await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'no-such-agent',
      }).catch(e => e);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(404);
      expect(slackChannel.disconnect).not.toHaveBeenCalled();
    });

    it('allows orphan disconnect when auth is not configured', async () => {
      const ctx = createContext(mastra);

      const result = await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'no-such-agent',
      });

      expect(result).toEqual({ success: true });
      expect(slackChannel.disconnect).toHaveBeenCalledWith('no-such-agent');
    });

    it('does not call channel.disconnect when ownership check rejects (no leaked side effects)', async () => {
      const ctx = asAuthenticatedUser(createContext(mastra), 'mallory');

      await DISCONNECT_CHANNEL_ROUTE.handler({
        ...ctx,
        platform: 'slack',
        agentId: 'agent-owned-by-alice',
      }).catch(() => {});

      expect(slackChannel.disconnect).not.toHaveBeenCalled();
    });
  });
});
