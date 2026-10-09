import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import { useClearDefaultModel, useDefaultModelQuery, useSetDefaultModel } from '../use-default-model';

const URL = `${TEST_BASE_URL}/web/config/default-model`;

describe('default model hooks', () => {
  it('loads the personal default model', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'openai/gpt-5' })));

    const { result } = renderHookWithProviders(() => useDefaultModelQuery());

    await waitFor(() => expect(result.current.data?.modelId).toBe('openai/gpt-5'));
  });

  it('sets the default model and refreshes the query', async () => {
    let modelId: string | null = null;
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId })),
      http.put(URL, async ({ request }) => {
        body = await request.json();
        modelId = 'anthropic/claude-sonnet-4-5';
        return HttpResponse.json({ ok: true, modelId });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      query: useDefaultModelQuery(),
      set: useSetDefaultModel(),
    }));
    await waitFor(() => expect(result.current.query.data?.modelId).toBeNull());

    await act(async () => {
      await result.current.set.mutateAsync('anthropic/claude-sonnet-4-5');
    });
    await waitForMutationsIdle(client);

    expect(body).toEqual({ modelId: 'anthropic/claude-sonnet-4-5' });
    await waitFor(() => expect(result.current.query.data?.modelId).toBe('anthropic/claude-sonnet-4-5'));
  });

  it('clears the default model and refreshes the query', async () => {
    let modelId: string | null = 'openai/gpt-5';
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId })),
      http.delete(URL, () => {
        modelId = null;
        return HttpResponse.json({ ok: true, modelId });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      query: useDefaultModelQuery(),
      clear: useClearDefaultModel(),
    }));
    await waitFor(() => expect(result.current.query.data?.modelId).toBe('openai/gpt-5'));

    await act(async () => {
      await result.current.clear.mutateAsync();
    });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.query.data?.modelId).toBeNull());
  });
});
