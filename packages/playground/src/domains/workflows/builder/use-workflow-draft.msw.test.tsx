import type { StoredWorkflowDefinition } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useWorkflowDraft, WorkflowDraftValidationError } from './use-workflow-draft';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const definition: StoredWorkflowDefinition = {
  id: 'daily-report',
  description: 'Builds the daily report',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  graph: [{ type: 'tool', id: 'fetch-data', toolId: 'report-data' }],
  status: 'active',
  source: 'storage',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('workflow draft save orchestration', () => {
  describe('when the authoritative draft is valid', () => {
    it('persists once through the stored-workflow API', async () => {
      const requests = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, async ({ request }) => {
          requests(await request.json());
          return HttpResponse.json({ ok: true as const, id: definition.id });
        }),
      );
      const draft = renderHook(() => useWorkflowDraft(definition, definition.id), { wrapper: createWrapper() });

      await act(async () => {
        await expect(draft.result.current.save()).resolves.toEqual({ ok: true, id: definition.id });
      });

      expect(requests).toHaveBeenCalledOnce();
      expect(requests).toHaveBeenCalledWith(expect.objectContaining({ id: definition.id, graph: definition.graph }));
    });
  });

  describe('when the authoritative draft is invalid', () => {
    it('rejects before making a persistence request', async () => {
      const requests = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, () => {
          requests();
          return HttpResponse.json({ ok: true as const, id: 'empty-workflow' });
        }),
      );
      const draft = renderHook(() => useWorkflowDraft(undefined, 'empty-workflow'), { wrapper: createWrapper() });

      await act(async () => {
        await expect(draft.result.current.save()).rejects.toBeInstanceOf(WorkflowDraftValidationError);
      });

      expect(requests).not.toHaveBeenCalled();
    });
  });

  describe('when a draft is checkpointed and finalized', () => {
    it('does not persist before explicit save', () => {
      const requests = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, () => {
          requests();
          return HttpResponse.json({ ok: true as const, id: definition.id });
        }),
      );
      const draft = renderHook(() => useWorkflowDraft(undefined, definition.id), { wrapper: createWrapper() });

      act(() => {
        const checkpoint = draft.result.current.checkpoint(0, definition);
        expect(checkpoint.ok).toBe(true);
        const finalized = draft.result.current.finalize(1);
        expect(finalized.ok).toBe(true);
      });

      expect(requests).not.toHaveBeenCalled();
    });
  });

  describe('when save has reserved a ready revision', () => {
    it('persists the immutable reserved snapshot while rejecting an edit', async () => {
      let resolveRequest: (() => void) | undefined;
      const requests = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, async ({ request }) => {
          requests(await request.json());
          await new Promise<void>(resolve => {
            resolveRequest = resolve;
          });
          return HttpResponse.json({ ok: true as const, id: definition.id });
        }),
      );
      const draft = renderHook(() => useWorkflowDraft(definition, definition.id), { wrapper: createWrapper() });

      let savePromise: ReturnType<typeof draft.result.current.save> | undefined;
      act(() => {
        savePromise = draft.result.current.save();
      });
      await vi.waitFor(() => expect(requests).toHaveBeenCalledOnce());

      act(() => {
        expect(draft.result.current.mutate(0, { type: 'set-identity', id: 'changed-after-save' })).toMatchObject({
          ok: false,
          error: 'Workflow save is in progress.',
        });
        resolveRequest?.();
      });
      await act(async () => {
        await savePromise;
      });

      expect(requests).toHaveBeenCalledWith(expect.objectContaining({ id: definition.id }));
    });
  });
});
