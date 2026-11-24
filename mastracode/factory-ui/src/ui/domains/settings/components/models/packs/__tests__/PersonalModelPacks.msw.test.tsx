import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { pickModel } from '../../defaults/__tests__/default-model-test-utils';
import { PersonalModelPacks } from '../PersonalModelPacks';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
  { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true },
];
const everyday: ModelPack = {
  id: 'everyday',
  name: 'Everyday',
  models: [{ modelId: 'openai/gpt-4o-mini', thinkingLevel: 'low' }],
};

function renderPacks(packSet: ModelPackSet) {
  const puts: ModelPackSet[] = [];
  let defaults: PersonalModelDefaultsResponse = {
    modelId: packSet.modelPacks[0]?.models[0]?.modelId ?? null,
    thinkingLevel: packSet.modelPacks[0]?.models[0]?.thinkingLevel ?? null,
    ...packSet,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models })),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json(defaults)),
    http.put<never, ModelPackSet>(`${TEST_BASE_URL}/web/config/model-packs`, async ({ request }) => {
      const body = await request.json();
      puts.push(body);
      defaults = { ...defaults, ...body };
      return HttpResponse.json(defaults);
    }),
  );
  const rendered = renderWithProviders(
    <MemoryRouter>
      <PersonalModelPacks />
    </MemoryRouter>,
  );
  return { ...rendered, puts };
}

describe('PersonalModelPacks', () => {
  it('adds a second pack without moving the default', async () => {
    const user = userEvent.setup();
    const { client, puts } = renderPacks({ modelPacks: [everyday], defaultModelPackId: everyday.id });

    await user.click(await screen.findByRole('button', { name: 'New pack' }));
    const form = screen.getByRole('form', { name: 'New pack' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Deep');
    await pickModel(user, 'Model', 'openai/gpt-5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(puts).toEqual([
      {
        modelPacks: [everyday, { id: expect.any(String), name: 'Deep', models: [{ modelId: 'openai/gpt-5', thinkingLevel: expect.any(String) }] }],
        defaultModelPackId: everyday.id,
      },
    ]);
    const list = await screen.findByRole('list', { name: 'Your model packs' });
    await waitFor(() => expect(within(list).getByRole('listitem', { name: 'Deep' })).toBeInTheDocument());
  });

  it('asks for a model before saving a pack', async () => {
    const user = userEvent.setup();
    const { puts } = renderPacks({ modelPacks: [], defaultModelPackId: null });

    expect(await screen.findByText(/No model packs yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New pack' }));
    const form = screen.getByRole('form', { name: 'New pack' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Everyday');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByText('Pick a model for every row, or remove the empty ones')).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('warns when no connected account can run the default pack model', async () => {
    renderPacks({
      modelPacks: [{ id: 'gone', name: 'Gone', models: [{ modelId: 'google/gemini-2.5-pro', thinkingLevel: 'medium' }] }],
      defaultModelPackId: 'gone',
    });

    expect(await screen.findByText(/None of your connected accounts can run/)).toBeInTheDocument();
  });
});
