/**
 * BDD coverage for intake source routing (which Factory project a Linear
 * project's issues land in). Drives the real service + React Query cache with
 * only the network mocked (MSW).
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { IntakeSourceBinding } from '../../ui/domains/factory/services/intake';
import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../useIntakeConfig';

const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;

const binding: IntakeSourceBinding = {
  integrationId: 'linear',
  sourceId: 'proj-1',
  factoryProjectId: 'factory-1',
};

describe('useIntakeBindingsQuery', () => {
  it('given stored routing, when the hook resolves, then it exposes the bindings', async () => {
    server.use(http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: [binding] })));

    const { result } = renderHookWithProviders(() => useIntakeBindingsQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([binding]);
  });

  it('given no routing, when the hook resolves, then it exposes an empty list', async () => {
    server.use(http.get(BINDINGS_URL, () => HttpResponse.json({})));

    const { result } = renderHookWithProviders(() => useIntakeBindingsQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });
});

describe('useSaveIntakeBindingMutation', () => {
  it('given a source is routed, when the mutation succeeds, then the cache holds the persisted routing', async () => {
    const requests: unknown[] = [];
    let stored: IntakeSourceBinding[] = [];
    server.use(
      http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: stored })),
      http.put(BINDINGS_URL, async ({ request }) => {
        const body = (await request.json()) as IntakeSourceBinding;
        requests.push(body);
        stored = body.factoryProjectId ? [body] : [];
        return HttpResponse.json({ bindings: stored });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      query: useIntakeBindingsQuery(),
      save: useSaveIntakeBindingMutation(),
    }));

    await waitFor(() => expect(result.current.query.data).toEqual([]));
    await act(async () => {
      await result.current.save.mutateAsync(binding);
    });

    expect(requests).toEqual([binding]);
    await waitFor(() => expect(result.current.query.data).toEqual([binding]));
  });

  it('given the server rejects the routing, when the mutation runs, then it surfaces the error message', async () => {
    server.use(
      http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: [] })),
      http.put(BINDINGS_URL, () => HttpResponse.json({ error: 'factory_project_not_found' }, { status: 404 })),
    );

    const { result } = renderHookWithProviders(() => useSaveIntakeBindingMutation());

    await expect(result.current.mutateAsync(binding)).rejects.toThrow('factory_project_not_found');
  });
});
