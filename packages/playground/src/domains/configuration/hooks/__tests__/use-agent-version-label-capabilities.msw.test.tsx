import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useAgentVersionLabelCapabilities } from '../use-agent-version-label-capabilities';
import {
  absentAgentVersionLabelCapabilities,
  agentVersionLabelsWithoutCompareAndSwap,
  agentVersionLabelsWithoutRetentionProtection,
  fullAgentVersionLabelCapabilities,
  readOnlyAgentVersionLabelCapabilities,
  storageWithoutVersionLabelCapabilities,
} from './fixtures/agent-version-label-capabilities';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

describe('useAgentVersionLabelCapabilities', () => {
  describe('when the system capability request is still loading', () => {
    it('does not imply read or mutation support', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, async () => {
          await delay(50);
          return HttpResponse.json(fullAgentVersionLabelCapabilities);
        }),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.supportsRead).toBe(false);
      expect(result.current.supportsMutation).toBe(false);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('when the server advertises every required agent label capability', () => {
    it('enables both reads and compare-and-swap mutations', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(fullAgentVersionLabelCapabilities)),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.supportsMutation).toBe(true));
      expect(result.current.supportsRead).toBe(true);
    });
  });

  describe('when a cached capability snapshot is invalidated', () => {
    it('fails closed while the replacement snapshot is fetched', async () => {
      let requests = 0;
      let resolveRefresh = () => {};
      const refreshGate = new Promise<void>(resolve => {
        resolveRefresh = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, async () => {
          requests += 1;
          if (requests === 1) return HttpResponse.json(fullAgentVersionLabelCapabilities);
          await refreshGate;
          return HttpResponse.json(absentAgentVersionLabelCapabilities);
        }),
      );
      const { wrapper, queryClient } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });
      await waitFor(() => expect(result.current.supportsMutation).toBe(true));

      act(() => {
        void queryClient.invalidateQueries({ queryKey: ['mastra-packages'] });
      });

      await waitFor(() => expect(result.current.isFetching).toBe(true));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.supportsRead).toBe(false);
      expect(result.current.supportsMutation).toBe(false);

      resolveRefresh();
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.supportsMutation).toBe(false);
    });
  });

  describe('when the server advertises read support without the mutation requirements', () => {
    it('keeps reads enabled and mutations disabled', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json(readOnlyAgentVersionLabelCapabilities),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.supportsRead).toBe(true));
      expect(result.current.supportsMutation).toBe(false);
    });
  });

  describe('when the storage cannot compare and swap label pointers', () => {
    it('keeps custom mutations disabled', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json(agentVersionLabelsWithoutCompareAndSwap),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMutation).toBe(false);
    });
  });

  describe('when the storage cannot protect label targets from retention', () => {
    it('keeps custom mutations disabled', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json(agentVersionLabelsWithoutRetentionProtection),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsMutation).toBe(false);
    });
  });

  describe('when an older server omits the capability', () => {
    it('treats agent version labels as unsupported', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(absentAgentVersionLabelCapabilities)),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsRead).toBe(false);
      expect(result.current.supportsMutation).toBe(false);
    });
  });

  describe('when storage capabilities exist without a version-label channel', () => {
    it('treats agent version labels as unsupported', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/system/packages`, () =>
          HttpResponse.json(storageWithoutVersionLabelCapabilities),
        ),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAgentVersionLabelCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.supportsRead).toBe(false);
      expect(result.current.supportsMutation).toBe(false);
    });
  });
});
