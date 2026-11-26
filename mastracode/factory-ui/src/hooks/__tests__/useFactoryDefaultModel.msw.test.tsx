import type { ModelPackSet } from '@mastra/factory/model-packs';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { FactoryProjectPayload } from '../../ui/domains/workspaces/services/github';
import {
  useFactoryProjectQuery,
  useSetFactoryModelPacksMutation,
  useSetFactoryModelScopeMutation,
} from '../useFactoryDefaultModel';

const FACTORY_ID = 'fp-1';
const URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;
const savedPacks: ModelPackSet = {
  modelPacks: [{ id: 'build', name: 'Build', models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'high' }] }],
  defaultModelPackId: 'build',
};

describe('Factory model settings hooks', () => {
  it('keeps a saved pack edit when an earlier model-scope save answers after it', async () => {
    let project: FactoryProjectPayload = {
      id: FACTORY_ID,
      name: 'Mastra',
      modelScope: 'factory',
      modelPacks: [],
      defaultModelPackId: null,
    };
    let scopeArrived = false;
    let answerScope!: () => void;
    const scopeAnswered = new Promise<void>(resolve => {
      answerScope = resolve;
    });
    server.use(
      http.get(URL, () => HttpResponse.json({ project })),
      http.patch<never, Partial<FactoryProjectPayload>>(URL, async ({ request }) => {
        const body = await request.json();
        project = { ...project, ...body };
        const answer = project;
        if ('modelScope' in body) {
          scopeArrived = true;
          await scopeAnswered;
        }
        return HttpResponse.json({ project: answer });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      project: useFactoryProjectQuery(FACTORY_ID),
      setScope: useSetFactoryModelScopeMutation(FACTORY_ID),
      setPacks: useSetFactoryModelPacksMutation(FACTORY_ID),
    }));
    await waitFor(() => expect(result.current.project.data).toBeDefined());

    act(() => result.current.setScope.mutate('user'));
    await waitFor(() => expect(scopeArrived).toBe(true));
    await act(() => result.current.setPacks.mutateAsync(savedPacks));
    act(answerScope);
    await waitForMutationsIdle(client);

    expect(result.current.project.data).toMatchObject({ modelScope: 'user', ...savedPacks });
  });
});
