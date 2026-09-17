import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  agentVersionQueryKeys,
  getAgentVersionInvalidationKeys,
  invalidateAgentVersionState,
  markAgentVersionEntityMissing,
} from '../agent-version-query-keys';

const AGENT_ID = 'agent-1';
const REQUEST_CONTEXT = { tenantId: 'tenant-1' };

describe('agentVersionQueryKeys', () => {
  describe('when keys are built for one agent and request context', () => {
    it('keeps every cache concern distinct and prefix-addressable', () => {
      expect({
        versionList: agentVersionQueryKeys.versionList(AGENT_ID, { page: 2 }, REQUEST_CONTEXT),
        completeVersionList: agentVersionQueryKeys.completeVersionList(
          AGENT_ID,
          { orderBy: { direction: 'DESC' } },
          REQUEST_CONTEXT,
        ),
        versionDetail: agentVersionQueryKeys.versionDetail(AGENT_ID, 'version-12', REQUEST_CONTEXT),
        labels: agentVersionQueryKeys.labels(AGENT_ID, REQUEST_CONTEXT),
        active: agentVersionQueryKeys.active(AGENT_ID),
        resolved: agentVersionQueryKeys.resolved(AGENT_ID),
        selector: agentVersionQueryKeys.selector(AGENT_ID),
        mutationIntegrity: agentVersionQueryKeys.mutationIntegrity(AGENT_ID),
        storedCollection: agentVersionQueryKeys.storedCollection,
        resolvedCollection: agentVersionQueryKeys.resolvedCollection,
        capability: agentVersionQueryKeys.capability,
        authorization: agentVersionQueryKeys.authorization,
      }).toEqual({
        versionList: ['agent-versions', AGENT_ID, { page: 2 }, REQUEST_CONTEXT],
        completeVersionList: [
          'agent-versions',
          AGENT_ID,
          'complete',
          { orderBy: { direction: 'DESC' } },
          REQUEST_CONTEXT,
        ],
        versionDetail: ['agent-version', AGENT_ID, 'version-12', REQUEST_CONTEXT],
        labels: ['agent-version-labels', AGENT_ID, REQUEST_CONTEXT],
        active: ['stored-agent', AGENT_ID],
        resolved: ['agent', AGENT_ID],
        selector: ['agent-version-selector', AGENT_ID],
        mutationIntegrity: ['agent-version-mutation-integrity', AGENT_ID],
        storedCollection: ['stored-agents'],
        resolvedCollection: ['agents'],
        capability: ['mastra-packages'],
        authorization: ['auth', 'capabilities'],
      });
    });
  });

  describe('when a pointer mutation needs coordinated invalidation', () => {
    it('returns every affected query prefix', () => {
      expect(getAgentVersionInvalidationKeys(AGENT_ID)).toEqual([
        ['agent-version-labels', AGENT_ID],
        ['agent-versions', AGENT_ID],
        ['agent-version', AGENT_ID],
        ['stored-agent', AGENT_ID],
        ['agent', AGENT_ID],
        ['agent-version-selector', AGENT_ID],
        ['stored-agents'],
        ['agents'],
      ]);
    });

    it('invalidates shared collections without invalidating another agent detail', async () => {
      const queryClient = new QueryClient();
      const paginatedVersionsKey = agentVersionQueryKeys.versionList(AGENT_ID, { page: 2 }, REQUEST_CONTEXT);
      const completeVersionsKey = agentVersionQueryKeys.completeVersionList(
        AGENT_ID,
        { orderBy: { direction: 'DESC' } },
        REQUEST_CONTEXT,
      );
      queryClient.setQueryData(paginatedVersionsKey, 'paginated versions');
      queryClient.setQueryData(completeVersionsKey, 'complete versions');
      queryClient.setQueryData(['stored-agents', { status: 'published' }], 'stored collection');
      queryClient.setQueryData(['agents', REQUEST_CONTEXT], 'merged collection');
      queryClient.setQueryData(['stored-agent', AGENT_ID, 'draft'], 'current agent');
      queryClient.setQueryData(['stored-agent', 'agent-2', 'draft'], 'other agent');

      await invalidateAgentVersionState(queryClient, AGENT_ID);

      expect(queryClient.getQueryState(paginatedVersionsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(completeVersionsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agents', { status: 'published' }])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['agents', REQUEST_CONTEXT])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agent', AGENT_ID, 'draft'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agent', 'agent-2', 'draft'])?.isInvalidated).toBe(false);
    });
  });

  describe('when the server reports that an agent is missing or inaccessible', () => {
    it('immediately clears cached singular agent representations', async () => {
      const queryClient = new QueryClient();
      const storedAgentKey = ['stored-agent', AGENT_ID, 'draft', REQUEST_CONTEXT];
      const resolvedAgentKey = ['agent', AGENT_ID, REQUEST_CONTEXT];
      queryClient.setQueryData(storedAgentKey, { id: AGENT_ID });
      queryClient.setQueryData(resolvedAgentKey, { id: AGENT_ID });

      const transition = markAgentVersionEntityMissing(queryClient, AGENT_ID);

      expect(queryClient.getQueryData(storedAgentKey)).toBeNull();
      expect(queryClient.getQueryData(resolvedAgentKey)).toBeNull();
      await transition;
    });

    it('invalidates dependent caches without changing another agent', async () => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(['agent-versions', AGENT_ID, 'seed'], 'current versions');
      queryClient.setQueryData(['stored-agents', { status: 'published' }], 'stored collection');
      queryClient.setQueryData(['agent', 'agent-2', REQUEST_CONTEXT], 'other agent');

      await markAgentVersionEntityMissing(queryClient, AGENT_ID);

      expect(queryClient.getQueryState(['agent-versions', AGENT_ID, 'seed'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agents', { status: 'published' }])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryData(['agent', 'agent-2', REQUEST_CONTEXT])).toBe('other agent');
    });
  });
});
