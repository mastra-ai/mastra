import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { useAutosaveAgent } from '../use-autosave-agent';
import { authEnabledCapabilities } from './fixtures/auth';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'autosave-agent';

const baseFormValues: AgentBuilderEditFormValues = {
  name: 'Initial',
  description: '',
  instructions: 'inst',
  tools: {},
  agents: {},
  workflows: {},
  skills: {},
};

const renderAutosave = ({
  defaultValues = baseFormValues,
  debounceMs = 50,
  savedDisplayMs = 30,
}: {
  defaultValues?: AgentBuilderEditFormValues;
  debounceMs?: number;
  savedDisplayMs?: number;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const formRef: { current: ReturnType<typeof useForm<AgentBuilderEditFormValues>> | null } = {
    current: null,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({ defaultValues });
    formRef.current = methods;
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>{children}</FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const view = renderHook(() => useAutosaveAgent({ agentId: AGENT_ID, debounceMs, savedDisplayMs }), {
    wrapper: Wrapper,
  });

  return { ...view, form: () => formRef.current!, queryClient };
};

// Waits for the auth-capabilities query (read by the hook's useDefaultVisibility)
// to settle, so no-edit assertions run after that async state update lands
// inside act instead of racing it with a bare sleep.
const waitForCapabilitiesSettled = (queryClient: QueryClient) =>
  waitFor(() =>
    expect(queryClient.getQueryCache().findAll({ queryKey: ['auth', 'capabilities'] })[0]?.state.status).toBe(
      'success',
    ),
  );

describe('useAutosaveAgent', () => {
  beforeEach(() => {
    usePlaygroundStore.setState({ requestContext: {} });
    // The hook resolves a default visibility via the real auth-capabilities
    // query; drive it through MSW instead of mocking the hook.
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authEnabledCapabilities)));
  });

  describe('when the hook mounts without edits', () => {
    it('does not PATCH the agent', async () => {
      let calls = 0;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          calls += 1;
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { result, queryClient } = renderAutosave({ debounceMs: 20 });
      await waitForCapabilitiesSettled(queryClient);

      expect(calls).toBe(0);
      expect(result.current.status).toBe('idle');
    });
  });

  describe('when a single field is edited', () => {
    it('debounces into one PATCH carrying the new value', async () => {
      let calls = 0;
      let lastBody: any = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
          calls += 1;
          lastBody = await request.json();
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { result, form } = renderAutosave({ debounceMs: 30, savedDisplayMs: 30 });

      await act(async () => {
        form().setValue('name', 'Renamed', { shouldDirty: true });
      });

      await waitFor(() => expect(calls).toBe(1));
      expect(lastBody.name).toBe('Renamed');
      await waitFor(() => expect(result.current.status).toBe('saved'));
      await waitFor(() => expect(result.current.status).toBe('idle'));
    });
  });

  describe('when a burst of edits happens within the debounce window', () => {
    it('collapses them into a single PATCH with the latest value', async () => {
      let calls = 0;
      let lastBody: any = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
          calls += 1;
          lastBody = await request.json();
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { form } = renderAutosave({ debounceMs: 60 });

      await act(async () => {
        form().setValue('name', 'A');
        form().setValue('name', 'AB');
        form().setValue('name', 'ABC');
        form().setValue('name', 'ABCD');
        form().setValue('name', 'ABCDE');
      });

      await waitFor(() => expect(calls).toBe(1), { timeout: 500 });
      expect(lastBody.name).toBe('ABCDE');
    });
  });

  describe('when the server fails the save', () => {
    it('reports an error and recovers via retry', async () => {
      let attempt = 0;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          attempt += 1;
          // The mastra client retries 5xx up to 3 times. Fail the whole first
          // save (4 attempts) then succeed on the retry().
          if (attempt <= 4) return HttpResponse.json({ error: 'boom' }, { status: 500 });
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { result, form } = renderAutosave({ debounceMs: 20 });

      await act(async () => {
        form().setValue('name', 'Boom');
      });

      await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 5_000 });
      expect(result.current.lastError).toBeInstanceOf(Error);

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 5_000 });
      expect(attempt).toBeGreaterThanOrEqual(5);
    });
  });

  describe('when flushNow is called with a pending edit', () => {
    it('fires the PATCH immediately instead of waiting for the debounce', async () => {
      let calls = 0;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          calls += 1;
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { result, form } = renderAutosave({ debounceMs: 5_000 });

      await act(async () => {
        form().setValue('name', 'Flushed');
      });

      expect(calls).toBe(0);

      await act(async () => {
        result.current.flushNow();
      });

      await waitFor(() => expect(calls).toBe(1));
    });
  });

  describe('when the hook unmounts with no pending edit', () => {
    it('does not PATCH the agent', async () => {
      let calls = 0;
      server.use(
        http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
          calls += 1;
          return HttpResponse.json({ id: AGENT_ID });
        }),
      );

      const { unmount, queryClient } = renderAutosave({ debounceMs: 20 });
      // Let the auth-capabilities query settle before unmount so its async state
      // update lands inside act rather than after the hook is gone.
      await waitForCapabilitiesSettled(queryClient);
      unmount();

      expect(calls).toBe(0);
    });
  });
});
