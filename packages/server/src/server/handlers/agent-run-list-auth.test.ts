import { Agent } from '@mastra/core/agent';
import { MastraFGAPermissions } from '@mastra/core/auth/ee';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { LIST_AGENT_RUNS_ROUTE, LIST_SUSPENDED_RUNS_ROUTE } from './agents';

for (const route of [LIST_AGENT_RUNS_ROUTE, LIST_SUSPENDED_RUNS_ROUTE]) {
  describe(`${route.path} authorization`, () => {
    let mastra: Mastra;
    let agent: Agent;
    let memory: MockMemory;
    let context: RequestContext;
    const check = vi.fn<IFGAProvider['check']>();
    const require = vi.fn<IFGAProvider['require']>();

    beforeEach(() => {
      check.mockReset().mockResolvedValue(false);
      require.mockReset().mockResolvedValue(undefined);
      const storage = new InMemoryStore();
      memory = new MockMemory({ storage });
      agent = new Agent({ id: 'a', name: 'a', instructions: 'test', model: {} as any, memory });
      mastra = new Mastra({ agents: { a: agent }, storage, logger: false });
      context = new RequestContext();
      context.set(MASTRA_USER_KEY, { id: 'user' });
      context.set('user', { id: 'user' });
      context.set(MASTRA_RESOURCE_ID_KEY, 'org');
    });

    function mockRuns(runs: Array<{ runId: string; threadId?: string; resourceId?: string }>) {
      const result = {
        runs: runs.map(run => ({
          ...run,
          status: 'suspended' as const,
          updatedAt: new Date(),
          suspendedAt: new Date(),
          toolCalls: [{ requiresApproval: true, args: { secret: run.runId }, suspendPayload: { secret: run.runId } }],
        })),
        total: runs.length,
      };
      vi.spyOn(agent, 'listRuns').mockResolvedValue(result);
      vi.spyOn(agent, 'listSuspendedRuns').mockResolvedValue(result);
      return result;
    }

    function enableFGA() {
      vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { check, require } as unknown as IFGAProvider });
    }

    async function list(query: { resourceId?: string; threadId?: string; page?: number; perPage?: number } = {}) {
      return route.handler({ mastra, agentId: 'a', requestContext: context, ...query });
    }

    it.each(['*', 'agents:*', 'agents:admin'])(
      'lets mapped admins with %s choose another resource or no resource',
      async permission => {
        mockRuns([]);
        context.set(MASTRA_USER_PERMISSIONS_KEY, [permission]);
        await list({ resourceId: 'other' });
        const method = route === LIST_AGENT_RUNS_ROUTE ? agent.listRuns : agent.listSuspendedRuns;
        expect(method).toHaveBeenLastCalledWith(expect.objectContaining({ resourceId: 'other' }));
        await list();
        expect(method).toHaveBeenLastCalledWith(expect.objectContaining({ resourceId: undefined }));
      },
    );

    it('rejects missing identity when server auth is configured even if client resource is provided', async () => {
      mockRuns([]);
      context = new RequestContext();
      vi.spyOn(mastra, 'getServer').mockReturnValue({ auth: { authenticateToken: async () => ({ id: 'user' }) } });
      await expect(list({ resourceId: 'other' })).rejects.toMatchObject({ status: 403 });
      expect(agent.listRuns).not.toHaveBeenCalled();
      expect(agent.listSuspendedRuns).not.toHaveBeenCalled();
    });

    it('filters denied, missing and threadless runs before pagination and totals, preserving allowed payloads', async () => {
      enableFGA();
      await memory.createThread({ threadId: 'allowed', resourceId: 'org' });
      await memory.createThread({ threadId: 'denied', resourceId: 'org' });
      check.mockImplementation(async (_user, params) => params.resource.id === 'allowed');
      const result = mockRuns([
        { runId: 'denied', threadId: 'denied', resourceId: 'org' },
        { runId: 'allowed-1', threadId: 'allowed', resourceId: 'org' },
        { runId: 'missing', threadId: 'missing', resourceId: 'org' },
        { runId: 'threadless', resourceId: 'org' },
        { runId: 'allowed-2', threadId: 'allowed', resourceId: 'org' },
      ]);
      expect(await list({ perPage: 1, page: 1 })).toEqual({ runs: [result.runs[4]], total: 2 });
      expect(check).toHaveBeenCalledTimes(2);
      expect(check).toHaveBeenCalledWith(
        { id: 'user' },
        expect.objectContaining({
          resource: { type: 'thread', id: 'allowed' },
          permission: MastraFGAPermissions.MEMORY_READ,
          context: expect.objectContaining({ resourceId: 'org', requestContext: context }),
        }),
      );
      const method = route === LIST_AGENT_RUNS_ROUTE ? agent.listRuns : agent.listSuspendedRuns;
      expect(method).toHaveBeenCalledWith(expect.objectContaining({ perPage: undefined, page: undefined }));
    });

    it('does not bypass thread FGA for an admin', async () => {
      enableFGA();
      context.set(MASTRA_USER_PERMISSIONS_KEY, ['*']);
      await memory.createThread({ threadId: 'denied', resourceId: 'other' });
      mockRuns([{ runId: 'denied', threadId: 'denied', resourceId: 'other' }]);
      expect(await list()).toEqual({ runs: [], total: 0 });
      expect(check).toHaveBeenCalledOnce();
    });

    it('fails closed with FGA configured and no authenticated user', async () => {
      enableFGA();
      mockRuns([{ runId: 'run', threadId: 'thread', resourceId: 'org' }]);
      context = new RequestContext();
      context.set(MASTRA_RESOURCE_ID_KEY, 'org');
      await expect(list()).rejects.toMatchObject({ status: 403 });
      expect(check).not.toHaveBeenCalled();
    });

    it('excludes runs if their stored thread belongs to another resource', async () => {
      enableFGA();
      check.mockResolvedValue(true);
      await memory.createThread({ threadId: 'moved-thread', resourceId: 'other' });
      mockRuns([{ runId: 'run', threadId: 'moved-thread', resourceId: 'org' }]);
      expect(await list()).toEqual({ runs: [], total: 0 });
      expect(check).not.toHaveBeenCalled();
    });

    it('excludes runs when memory is unavailable under FGA', async () => {
      enableFGA();
      mockRuns([{ runId: 'run', threadId: 'thread', resourceId: 'org' }]);
      vi.spyOn(agent, 'getMemory').mockResolvedValue(undefined);
      expect(await list()).toEqual({ runs: [], total: 0 });
    });

    it('propagates FGA service failures instead of returning an incomplete success', async () => {
      enableFGA();
      await memory.createThread({ threadId: 'thread', resourceId: 'org' });
      mockRuns([{ runId: 'run', threadId: 'thread', resourceId: 'org' }]);
      check.mockRejectedValue(new Error('FGA unavailable'));
      await expect(list()).rejects.toMatchObject({ status: 500 });
    });
  });
}
