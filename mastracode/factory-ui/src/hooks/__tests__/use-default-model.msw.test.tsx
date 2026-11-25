import type { ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import { useDefaultModelQuery, useSetDefaultModel, useSetPersonalModelPacks } from '../use-default-model';

const URL = `${TEST_BASE_URL}/web/config/default-model`;

describe('default model hooks', () => {
  it('loads the personal default model', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ modelId: 'openai/gpt-5', thinkingLevel: null })));

    const { result } = renderHookWithProviders(() => useDefaultModelQuery());

    await waitFor(() => expect(result.current.data?.modelId).toBe('openai/gpt-5'));
  });

  it('sets the default model and refreshes the query', async () => {
    let modelId: string | null = null;
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json({ modelId, thinkingLevel: null })),
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

  it('saves personal model packs and shows the saved default model', async () => {
    let saved: PersonalModelDefaultsResponse = {
      modelId: null,
      thinkingLevel: null,
      modelPacks: [],
      defaultModelPackId: null,
    };
    let body: unknown;
    server.use(
      http.get(URL, () => HttpResponse.json(saved)),
      http.put(`${TEST_BASE_URL}/web/config/model-packs`, async ({ request }) => {
        body = await request.json();
        saved = {
          modelId: 'openai/gpt-5',
          thinkingLevel: 'high',
          modelPacks: [{ id: 'build', name: 'Build', models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'high' }] }],
          defaultModelPackId: 'build',
        };
        return HttpResponse.json(saved);
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      query: useDefaultModelQuery(),
      save: useSetPersonalModelPacks(),
    }));
    await waitFor(() => expect(result.current.query.data?.modelId).toBeNull());

    const packs: ModelPackSet = {
      modelPacks: [{ id: 'build', name: 'Build', models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'high' }] }],
      defaultModelPackId: 'build',
    };
    await act(async () => {
      await result.current.save.mutateAsync(packs);
    });
    await waitForMutationsIdle(client);

    expect(body).toEqual(packs);
    await waitFor(() => expect(result.current.query.data?.modelId).toBe('openai/gpt-5'));
    expect(result.current.query.data?.defaultModelPackId).toBe('build');
  });
});
