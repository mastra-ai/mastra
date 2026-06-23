// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { useAutosaveAgent } from '../use-autosave-agent';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

vi.mock('@/domains/auth/hooks/use-default-visibility', () => ({
  useDefaultVisibility: () => 'private',
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

  return { ...view, form: () => formRef.current! };
};

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe('useAutosaveAgent', () => {
  it('does not PATCH on mount', async () => {
    let calls = 0;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        calls += 1;
        return HttpResponse.json({ id: AGENT_ID });
      }),
    );

    const { result } = renderAutosave({ debounceMs: 20 });
    await wait(80);

    expect(calls).toBe(0);
    expect(result.current.status).toBe('idle');
  });

  it('debounces a single field edit and transitions through saving → saved → idle', async () => {
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

  it('collapses a burst of edits into a single PATCH with the latest value', async () => {
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

  it('reports error on server failure and recovers via retry', async () => {
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

  it('flushNow fires the pending PATCH immediately', async () => {
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

  it('does not PATCH after unmount when no edit was pending', async () => {
    let calls = 0;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        calls += 1;
        return HttpResponse.json({ id: AGENT_ID });
      }),
    );

    const { unmount } = renderAutosave({ debounceMs: 20 });
    unmount();
    await wait(80);

    expect(calls).toBe(0);
  });
});
