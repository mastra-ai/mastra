import type { AgentVersionLabel } from '@mastra/client-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { agentVersionQueryKeys, getAgentVersionInvalidationKeys } from '../agent-version-query-keys';
import { useAgent } from '../use-agent';
import {
  useDeleteAgentVersionLabel,
  useAgentVersionLabels,
  useSetAgentVersionLabel,
} from '../use-agent-version-labels';
import { useActivateAgentVersion } from '../use-agent-versions';
import { useStoredAgent } from '../use-stored-agents';
import {
  activateVersionResponse,
  cachedResolvedAgent,
  cachedStoredAgent,
  deletePreviewLabelResponse,
  entityNotFoundError,
  firstLabelPage,
  labelNotFoundError,
  labelMoveConflictError,
  secondLabelPageWithDuplicate,
  setPreviewLabelResponse,
  unsupportedVersionLabelsError,
  versionNotFoundError,
} from './fixtures/agent-version-labels';
import { agentVersionAccessCapabilities } from '@/domains/auth/hooks/__tests__/fixtures/agent-version-access';
import { useAgentVersionAccess } from '@/domains/auth/hooks/use-agent-version-access';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import {
  absentAgentVersionLabelCapabilities,
  fullAgentVersionLabelCapabilities,
} from '@/domains/configuration/hooks/__tests__/fixtures/agent-version-label-capabilities';
import { useAgentVersionLabelCapabilities } from '@/domains/configuration/hooks/use-agent-version-label-capabilities';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';

const createDeferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(settle => {
    resolve = settle;
  });
  return { promise, resolve };
};

const registerPaginatedLabels = (onPage?: (page: number) => void) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      onPage?.(page);
      return HttpResponse.json(page === 0 ? firstLabelPage : secondLabelPageWithDuplicate);
    }),
  );
};

const seedAgentVersionQueries = (queryClient: ReturnType<typeof makeWrapper>['queryClient']) => {
  const invalidationKeys = getAgentVersionInvalidationKeys(AGENT_ID);
  for (const key of invalidationKeys) {
    queryClient.setQueryData([...key, 'seed'], 'cached');
  }
};

const expectAgentVersionQueriesInvalidated = (queryClient: ReturnType<typeof makeWrapper>['queryClient']) => {
  const invalidationKeys = getAgentVersionInvalidationKeys(AGENT_ID);
  for (const key of invalidationKeys) {
    expect(queryClient.getQueryState([...key, 'seed'])?.isInvalidated).toBe(true);
  }
};

const seedCachedAgentDetails = (queryClient: ReturnType<typeof makeWrapper>['queryClient']) => {
  queryClient.setQueryData(['stored-agent', AGENT_ID, 'draft', 'seed'], cachedStoredAgent);
  queryClient.setQueryData(['agent', AGENT_ID, 'seed'], cachedResolvedAgent);
};

const expectCachedAgentDetailsMissing = (queryClient: ReturnType<typeof makeWrapper>['queryClient']) => {
  expect(queryClient.getQueryData(['stored-agent', AGENT_ID, 'draft', 'seed'])).toBeNull();
  expect(queryClient.getQueryData(['agent', AGENT_ID, 'seed'])).toBeNull();
};

describe('useAgentVersionLabels', () => {
  describe('when the server reports another page and repeats a label on that page', () => {
    it('returns every unique label in first-seen server order', async () => {
      registerPaginatedLabels();
      const { wrapper, queryClient } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabels({ agentId: AGENT_ID }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.labels.map((label: AgentVersionLabel) => label.name)).toEqual([
        'production',
        'preview',
        'latest',
      ]);
      expect(result.current.data?.pagination).toEqual({
        total: 3,
        page: 0,
        perPage: 2,
        hasMore: false,
      });
      expect(
        queryClient.getQueryCache().findAll({ queryKey: agentVersionQueryKeys.labelsRoot(AGENT_ID) }),
      ).toHaveLength(1);
    });

    it('requests pages until hasMore is false', async () => {
      const pages: number[] = [];
      const perPageValues: Array<string | null> = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page'));
          pages.push(page);
          perPageValues.push(url.searchParams.get('perPage'));
          return HttpResponse.json(page === 0 ? firstLabelPage : secondLabelPageWithDuplicate);
        }),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabels({ agentId: AGENT_ID }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(pages).toEqual([0, 1]);
      expect(perPageValues).toEqual(['50', '50']);
    });
  });

  describe('when the query is disabled', () => {
    it('does not call the label endpoint', async () => {
      const onLabels = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(firstLabelPage);
        }),
      );
      const { wrapper } = makeWrapper();

      renderHook(() => useAgentVersionLabels({ agentId: AGENT_ID, enabled: false }), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 25));
      expect(onLabels).not.toHaveBeenCalled();
    });
  });

  describe('when a request context is present', () => {
    it('uses a cache key distinct from the same agent without that context', () => {
      expect(agentVersionQueryKeys.labels(AGENT_ID, { tenantId: 'tenant-1' })).not.toEqual(
        agentVersionQueryKeys.labels(AGENT_ID, {}),
      );
    });
  });

  describe('when stale discovery enables a read that the server reports as unsupported', () => {
    it('refreshes capability discovery and settles into the unsupported state', async () => {
      let packageRequests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => {
          packageRequests += 1;
          return HttpResponse.json(
            packageRequests === 1 ? fullAgentVersionLabelCapabilities : absentAgentVersionLabelCapabilities,
          );
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () =>
          HttpResponse.json(unsupportedVersionLabelsError, { status: 501 }),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(
        () => {
          const capability = useAgentVersionLabelCapabilities();
          const labels = useAgentVersionLabels({ agentId: AGENT_ID, enabled: capability.supportsRead });
          return { capability, labels };
        },
        { wrapper },
      );

      await waitFor(() => expect(result.current.labels.isError).toBe(true));
      await waitFor(() => expect(result.current.capability.supportsRead).toBe(false));
      expect(packageRequests).toBe(2);
    });
  });

  describe('when the label read is rejected by current authorization', () => {
    it('refreshes authorization without invalidating capability discovery', async () => {
      const onLabels = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.text('', { status: 403 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');

      const { result } = renderHook(() => useAgentVersionLabels({ agentId: AGENT_ID }), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await waitFor(() =>
        expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(true),
      );
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      expect(onLabels).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the label read reports that the agent is missing or inaccessible', () => {
    it('clears entity details and refreshes dependents without retrying the failing label query', async () => {
      const onLabels = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, () => {
          onLabels();
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);

      const { result } = renderHook(() => useAgentVersionLabels({ agentId: AGENT_ID }), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await waitFor(() => {
        expect(queryClient.getQueryData([...agentVersionQueryKeys.active(AGENT_ID), 'seed'])).toBeNull();
        expect(queryClient.getQueryData([...agentVersionQueryKeys.resolved(AGENT_ID), 'seed'])).toBeNull();
        for (const key of [
          agentVersionQueryKeys.versionLists(AGENT_ID),
          agentVersionQueryKeys.versionDetails(AGENT_ID),
          agentVersionQueryKeys.selector(AGENT_ID),
          agentVersionQueryKeys.storedCollection,
          agentVersionQueryKeys.resolvedCollection,
        ]) {
          expect(queryClient.getQueryState([...key, 'seed'])?.isInvalidated).toBe(true);
        }
      });
      expect(queryClient.getQueryState([...agentVersionQueryKeys.labelsRoot(AGENT_ID), 'seed'])?.isInvalidated).toBe(
        false,
      );
      expect(onLabels).toHaveBeenCalledOnce();
    });

    it('immediately transitions active cached detail consumers to their missing state', async () => {
      let releaseLabelRead = () => {};
      const labelReadGate = new Promise<void>(resolve => {
        releaseLabelRead = resolve;
      });
      const onResolvedAgent = vi.fn();
      const onStoredAgent = vi.fn();
      const onLabels = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => {
          onResolvedAgent();
          return HttpResponse.json(cachedResolvedAgent);
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          onStoredAgent();
          return HttpResponse.json(cachedStoredAgent);
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, async () => {
          onLabels();
          await labelReadGate;
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(
        () => ({
          agent: useAgent(AGENT_ID),
          storedAgent: useStoredAgent(AGENT_ID),
          labels: useAgentVersionLabels({ agentId: AGENT_ID }),
        }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.agent.data).toEqual(cachedResolvedAgent));
      await waitFor(() => expect(result.current.storedAgent.data).toEqual(cachedStoredAgent));
      releaseLabelRead();
      await waitFor(() => expect(result.current.labels.isError).toBe(true));
      expect(result.current.agent.data).toBeNull();
      expect(result.current.storedAgent.data).toBeNull();
      expect(onResolvedAgent).toHaveBeenCalledOnce();
      expect(onStoredAgent).toHaveBeenCalledOnce();
      expect(onLabels).toHaveBeenCalledOnce();
    });

    it('cancels in-flight singular detail reads so their late responses cannot restore the entity', async () => {
      const detailReadGate = createDeferred();
      const detailReadsStarted = createDeferred();
      const detailResponsesProduced = createDeferred();
      let startedReads = 0;
      let producedResponses = 0;
      const recordStartedRead = () => {
        startedReads += 1;
        if (startedReads === 2) detailReadsStarted.resolve();
      };
      const recordProducedResponse = () => {
        producedResponses += 1;
        if (producedResponses === 2) detailResponsesProduced.resolve();
      };
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, async () => {
          recordStartedRead();
          await detailReadGate.promise;
          recordProducedResponse();
          return HttpResponse.json(cachedResolvedAgent);
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}`, async () => {
          recordStartedRead();
          await detailReadGate.promise;
          recordProducedResponse();
          return HttpResponse.json(cachedStoredAgent);
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, async () => {
          await detailReadsStarted.promise;
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();

      const { result } = renderHook(
        () => ({
          agent: useAgent(AGENT_ID),
          storedAgent: useStoredAgent(AGENT_ID),
          labels: useAgentVersionLabels({ agentId: AGENT_ID }),
        }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.labels.isError).toBe(true));
      expect(result.current.agent.data).toBeNull();
      expect(result.current.storedAgent.data).toBeNull();

      await act(async () => {
        detailReadGate.resolve();
        await detailResponsesProduced.promise;
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(result.current.agent.data).toBeNull();
      expect(result.current.storedAgent.data).toBeNull();
    });
  });

  describe('when a failed label query is observed again after its consumer remounts', () => {
    it('does not retry the GET or repeat authorization recovery for the same cached error', async () => {
      const labelReadGate = createDeferred();
      let authorizationRequests = 0;
      let labelRequests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => {
          authorizationRequests += 1;
          return HttpResponse.json(agentVersionAccessCapabilities([`stored-agents:read:${AGENT_ID}`]));
        }),
        http.get(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels`, async () => {
          labelRequests += 1;
          await labelReadGate.promise;
          return HttpResponse.text('', { status: 403 });
        }),
      );
      const { wrapper } = makeWrapper();
      const useAuthorizationAndLabels = () => ({
        authorization: useAuthCapabilities(),
        labels: useAgentVersionLabels({ agentId: AGENT_ID }),
      });
      const firstConsumer = renderHook(useAuthorizationAndLabels, { wrapper });

      await waitFor(() => expect(firstConsumer.result.current.authorization.isSuccess).toBe(true));
      labelReadGate.resolve();
      await waitFor(() => expect(firstConsumer.result.current.labels.isError).toBe(true));
      await waitFor(() => expect(authorizationRequests).toBe(2));
      firstConsumer.unmount();

      const secondConsumer = renderHook(useAuthorizationAndLabels, { wrapper });

      await waitFor(() => expect(secondConsumer.result.current.labels.isError).toBe(true));
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(labelRequests).toBe(1);
      expect(authorizationRequests).toBe(2);
    });
  });
});

describe('useSetAgentVersionLabel', () => {
  describe('when creating a label succeeds', () => {
    it('sends the expected-absent compare-and-swap input unchanged', async () => {
      let requestBody: unknown;
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json(setPreviewLabelResponse);
        }),
      );
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          label: 'preview',
          input: { versionId: 'version-12', expectedRevisionToken: null },
        });
      });

      expect(requestBody).toEqual({ versionId: 'version-12', expectedRevisionToken: null });
    });

    it('invalidates every version pointer consumer', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.json(setPreviewLabelResponse),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      queryClient.setQueryData(['unrelated-query'], 'cached');
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          label: 'preview',
          input: { versionId: 'version-12', expectedRevisionToken: null },
        });
      });

      expectAgentVersionQueriesInvalidated(queryClient);
      expect(queryClient.getQueryState(['unrelated-query'])?.isInvalidated).toBe(false);
    });
  });

  describe('when the server reports that version labels are unsupported', () => {
    it('invalidates capability discovery', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.json(unsupportedVersionLabelsError, { status: 501 }),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      seedAgentVersionQueries(queryClient);
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { versionId: 'version-12', expectedRevisionToken: null },
          })
          .catch(() => undefined);
      });

      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(false);
      for (const key of getAgentVersionInvalidationKeys(AGENT_ID)) {
        expect(queryClient.getQueryState([...key, 'seed'])?.isInvalidated).toBe(false);
      }
    });
  });

  describe('when moving a label conflicts with a newer server revision', () => {
    it('refreshes pointer consumers without retrying the stale write', async () => {
      const onSetLabel = vi.fn();
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () => {
          onSetLabel();
          return HttpResponse.json(labelMoveConflictError, { status: 409 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { versionId: 'version-12', expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      expect(onSetLabel).toHaveBeenCalledTimes(1);
      expectAgentVersionQueriesInvalidated(queryClient);
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(false);
    });
  });

  describe('when a label target version no longer exists', () => {
    it('refreshes authoritative pointer state without changing discovery caches', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.json(versionNotFoundError, { status: 404 }),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { versionId: 'version-missing', expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      expectAgentVersionQueriesInvalidated(queryClient);
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(false);
    });
  });

  describe('when creating a label reports that the agent is missing or inaccessible', () => {
    it('transitions cached agent details without retrying the create', async () => {
      const onSetLabel = vi.fn();
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () => {
          onSetLabel();
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedCachedAgentDetails(queryClient);
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { versionId: 'version-12', expectedRevisionToken: null },
          })
          .catch(() => undefined);
      });

      expectCachedAgentDetailsMissing(queryClient);
      expect(onSetLabel).toHaveBeenCalledOnce();
    });
  });

  describe('when moving a label reports that the agent is missing or inaccessible', () => {
    it('transitions cached agent details without retrying the move', async () => {
      const onSetLabel = vi.fn();
      server.use(
        http.put(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () => {
          onSetLabel();
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedCachedAgentDetails(queryClient);
      const { result } = renderHook(() => useSetAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { versionId: 'version-12', expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      expectCachedAgentDetailsMissing(queryClient);
      expect(onSetLabel).toHaveBeenCalledOnce();
    });
  });
});

describe('useDeleteAgentVersionLabel', () => {
  describe('when deleting a label succeeds', () => {
    it('sends the observed revision token and invalidates every pointer consumer', async () => {
      let revisionToken: string | null = null;
      server.use(
        http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, ({ request }) => {
          revisionToken = new URL(request.url).searchParams.get('expectedRevisionToken');
          return HttpResponse.json(deletePreviewLabelResponse);
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      const { result } = renderHook(() => useDeleteAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          label: 'preview',
          input: { expectedRevisionToken: 'revision-preview-1' },
        });
      });

      expect(revisionToken).toBe('revision-preview-1');
      expectAgentVersionQueriesInvalidated(queryClient);
    });
  });

  describe('when the server rejects a stale authorization snapshot', () => {
    it('invalidates authorization discovery', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.text('', { status: 403 }),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      seedAgentVersionQueries(queryClient);
      const { result } = renderHook(() => useDeleteAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      for (const key of getAgentVersionInvalidationKeys(AGENT_ID)) {
        expect(queryClient.getQueryState([...key, 'seed'])?.isInvalidated).toBe(false);
      }
    });
  });

  describe('when a live denial invalidates a previously authorized publisher', () => {
    it('removes publish access while replacement authorization is fetched', async () => {
      let authorizationRequests = 0;
      let resolveRefresh = () => {};
      const refreshGate = new Promise<void>(resolve => {
        resolveRefresh = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, async () => {
          authorizationRequests += 1;
          if (authorizationRequests === 1) {
            return HttpResponse.json(agentVersionAccessCapabilities([`stored-agents:publish:${AGENT_ID}`]));
          }
          await refreshGate;
          return HttpResponse.json(agentVersionAccessCapabilities([]));
        }),
        http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.text('', { status: 403 }),
        ),
      );
      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => ({
          access: useAgentVersionAccess(AGENT_ID),
          deleteLabel: useDeleteAgentVersionLabel({ agentId: AGENT_ID }),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.access.canPublish).toBe(true));

      await act(async () => {
        await result.current.deleteLabel
          .mutateAsync({
            label: 'preview',
            input: { expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      await waitFor(() => expect(result.current.access.isFetching).toBe(true));
      expect(result.current.access.canPublish).toBe(false);

      resolveRefresh();
      await waitFor(() => expect(result.current.access.isFetching).toBe(false));
    });
  });

  describe('when the selected label no longer exists', () => {
    it('refreshes authoritative pointer state without changing discovery caches', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () =>
          HttpResponse.json(labelNotFoundError, { status: 404 }),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      const { result } = renderHook(() => useDeleteAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({
            label: 'preview',
            input: { expectedRevisionToken: 'revision-preview-1' },
          })
          .catch(() => undefined);
      });

      expectAgentVersionQueriesInvalidated(queryClient);
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(false);
    });
  });

  describe('when deleting a label reports that the agent is missing or inaccessible', () => {
    it('transitions cached agent details without retrying the delete', async () => {
      const onDeleteLabel = vi.fn();
      server.use(
        http.delete(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/labels/preview`, () => {
          onDeleteLabel();
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedCachedAgentDetails(queryClient);
      const { result } = renderHook(() => useDeleteAgentVersionLabel({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({ label: 'preview', input: { expectedRevisionToken: 'revision-preview-1' } })
          .catch(() => undefined);
      });

      expectCachedAgentDetailsMissing(queryClient);
      expect(onDeleteLabel).toHaveBeenCalledOnce();
    });
  });
});

describe('useActivateAgentVersion', () => {
  describe('when activation includes the observed active version and succeeds', () => {
    it('preserves the precondition and invalidates every pointer consumer', async () => {
      let requestBody: unknown;
      server.use(
        http.post(
          `${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/version-12/activate`,
          async ({ request }) => {
            requestBody = await request.json();
            return HttpResponse.json(activateVersionResponse);
          },
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      const { result } = renderHook(() => useActivateAgentVersion({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ versionId: 'version-12', expectedActiveVersionId: 'version-10' });
      });

      expect(requestBody).toEqual({ expectedActiveVersionId: 'version-10' });
      expectAgentVersionQueriesInvalidated(queryClient);
    });
  });

  describe('when activation conflicts with a newer production pointer', () => {
    it('does not retry the stale activation', async () => {
      const onActivate = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/version-12/activate`, () => {
          onActivate();
          return HttpResponse.json(labelMoveConflictError, { status: 409 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedAgentVersionQueries(queryClient);
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      const { result } = renderHook(() => useActivateAgentVersion({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({ versionId: 'version-12', expectedActiveVersionId: 'version-10' })
          .catch(() => undefined);
      });

      expect(onActivate).toHaveBeenCalledTimes(1);
      expectAgentVersionQueriesInvalidated(queryClient);
      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(false);
    });
  });

  describe('when activation is rejected by current authorization', () => {
    it('refreshes authorization without invalidating label capability discovery', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/version-12/activate`, () =>
          HttpResponse.text('', { status: 403 }),
        ),
      );
      const { wrapper, queryClient } = makeWrapper();
      queryClient.setQueryData(agentVersionQueryKeys.authorization, 'authorized');
      queryClient.setQueryData(agentVersionQueryKeys.capability, 'supported');
      seedAgentVersionQueries(queryClient);
      const { result } = renderHook(() => useActivateAgentVersion({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({ versionId: 'version-12', expectedActiveVersionId: 'version-10' })
          .catch(() => undefined);
      });

      expect(queryClient.getQueryState(agentVersionQueryKeys.authorization)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(agentVersionQueryKeys.capability)?.isInvalidated).toBe(false);
      for (const key of getAgentVersionInvalidationKeys(AGENT_ID)) {
        expect(queryClient.getQueryState([...key, 'seed'])?.isInvalidated).toBe(false);
      }
    });
  });

  describe('when the agent no longer exists or is inaccessible', () => {
    it('transitions cached agent details without retrying the Production move', async () => {
      const onActivate = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/api/stored/agents/${AGENT_ID}/versions/version-12/activate`, () => {
          onActivate();
          return HttpResponse.json(entityNotFoundError, { status: 404 });
        }),
      );
      const { wrapper, queryClient } = makeWrapper();
      seedCachedAgentDetails(queryClient);
      const { result } = renderHook(() => useActivateAgentVersion({ agentId: AGENT_ID }), { wrapper });

      await act(async () => {
        await result.current
          .mutateAsync({ versionId: 'version-12', expectedActiveVersionId: 'version-10' })
          .catch(() => undefined);
      });

      expectCachedAgentDetailsMissing(queryClient);
      expect(onActivate).toHaveBeenCalledOnce();
    });
  });
});
