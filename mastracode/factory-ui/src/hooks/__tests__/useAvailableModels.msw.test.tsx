import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../e2e/ui/render';
import { useAvailableModelsQuery, usePersonalAvailableModelsQuery } from '../useAvailableModels';

describe('personal model catalog', () => {
  it('asks for the user-scoped catalog, cached apart from the Factory catalog', async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
        const search = new URL(request.url).search;
        queries.push(search);
        const id = search === '?scope=user' ? 'openai/gpt-5' : 'deepseek/deepseek-flash';
        return HttpResponse.json({ models: [{ id, provider: id.split('/')[0], modelName: id, hasApiKey: true }] });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      factory: useAvailableModelsQuery('fp-1'),
      personal: usePersonalAvailableModelsQuery(),
    }));

    await waitFor(() => expect(result.current.personal.data?.map(m => m.id)).toEqual(['openai/gpt-5']));
    await waitFor(() => expect(result.current.factory.data?.map(m => m.id)).toEqual(['deepseek/deepseek-flash']));
    expect([...queries].sort()).toEqual(['?factoryId=fp-1', '?scope=user']);
  });
});
