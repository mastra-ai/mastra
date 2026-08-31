import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useAgentVersionAccess } from '../use-agent-version-access';
import { agentVersionAccessCapabilities } from './fixtures/agent-version-access';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';

describe('useAgentVersionAccess', () => {
  describe('when authorization is still loading', () => {
    it('does not expose read, publish, or execute access', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, async () => {
          await delay(50);
          return HttpResponse.json(agentVersionAccessCapabilities(['*']));
        }),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      expect(result.current.canRead).toBe(false);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canExecute).toBe(false);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('when the user has global read and scoped publish and execute grants', () => {
    it('grants every operation for the matching agent', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(
            agentVersionAccessCapabilities([
              'stored-agents:read',
              `stored-agents:publish:${AGENT_ID}`,
              `agents:execute:${AGENT_ID}`,
            ]),
          ),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canPublish).toBe(true);
      expect(result.current.canExecute).toBe(true);
    });
  });

  describe('when scoped grants belong to another agent', () => {
    it('denies those operations for the current agent', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(
            agentVersionAccessCapabilities([
              'stored-agents:read:agent-2',
              'stored-agents:publish:agent-2',
              'agents:execute:agent-2',
            ]),
          ),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canRead).toBe(false);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canExecute).toBe(false);
    });
  });

  describe('when the user has execute-only access for the current agent', () => {
    it('allows runs without exposing label reads or publishing', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json(agentVersionAccessCapabilities([`agents:execute:${AGENT_ID}`])),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canRead).toBe(false);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canExecute).toBe(true);
    });
  });

  describe('when RBAC is disabled', () => {
    it('grants every operation after authorization discovery completes', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.canRead).toBe(true);
      expect(result.current.canPublish).toBe(true);
      expect(result.current.canExecute).toBe(true);
    });
  });

  describe('when authorization discovery fails', () => {
    it('fails closed instead of interpreting missing capabilities as disabled RBAC', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () =>
          HttpResponse.json({ error: 'authorization unavailable' }, { status: 503 }),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.canRead).toBe(false);
      expect(result.current.canPublish).toBe(false);
      expect(result.current.canExecute).toBe(false);
    });
  });

  describe('when authorization discovery is paused before the first snapshot', () => {
    it('fails closed instead of treating absent authorization data as disabled RBAC', () => {
      onlineManager.setOnline(false);
      const { wrapper } = makeWrapper();
      const { result, unmount } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });

      try {
        expect(result.current.isFetching).toBe(false);
        expect(result.current.canRead).toBe(false);
        expect(result.current.canPublish).toBe(false);
        expect(result.current.canExecute).toBe(false);
      } finally {
        unmount();
        onlineManager.setOnline(true);
      }
    });
  });

  describe('when a cached authorization snapshot is invalidated', () => {
    it('fails closed while the replacement snapshot is fetched', async () => {
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
      );
      const { wrapper, queryClient } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionAccess(AGENT_ID), { wrapper });
      await waitFor(() => expect(result.current.canPublish).toBe(true));

      act(() => {
        void queryClient.invalidateQueries({ queryKey: ['auth', 'capabilities'] });
      });

      await waitFor(() => expect(result.current.isFetching).toBe(true));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.canPublish).toBe(false);

      resolveRefresh();
      await waitFor(() => expect(result.current.isFetching).toBe(false));
    });
  });
});
