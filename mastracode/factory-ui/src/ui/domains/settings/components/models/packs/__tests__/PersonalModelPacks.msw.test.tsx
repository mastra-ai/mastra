import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { pickPackModel } from './pack-model-test-utils';
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

function renderPacks(packSet: ModelPackSet, fallbackModelId?: string | null) {
  const puts: ModelPackSet[] = [];
  let defaults: PersonalModelDefaultsResponse = {
    modelId: packSet.modelPacks[0]?.models[0]?.modelId ?? null,
    thinkingLevel: packSet.modelPacks[0]?.models[0]?.thinkingLevel ?? null,
    ...packSet,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models, fallbackModelId })),
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
  it('moves keyboard focus to a newly saved pack without changing the default', async () => {
    const user = userEvent.setup();
    const { client, puts } = renderPacks({ modelPacks: [everyday], defaultModelPackId: everyday.id });

    const newPack = await screen.findByRole('button', { name: 'New pack' });
    act(() => newPack.focus());
    await user.keyboard('{Enter}');
    const form = screen.getByRole('form', { name: 'New pack' });
    expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await user.keyboard('Deep');
    await pickPackModel(user, 'Choose a model', 'GPT-5');
    act(() => within(form).getByRole('button', { name: 'Save' }).focus());
    await user.keyboard('{Enter}');
    await waitForMutationsIdle(client);

    expect(puts).toEqual([
      {
        modelPacks: [
          everyday,
          {
            id: expect.any(String),
            name: 'Deep',
            models: [{ modelId: 'openai/gpt-5', thinkingLevel: expect.any(String) }],
          },
        ],
        defaultModelPackId: everyday.id,
      },
    ]);
    const otherPacks = await screen.findByRole('list', { name: 'Other packs' });
    await waitFor(() => expect(within(otherPacks).getByRole('listitem', { name: 'Deep' })).toHaveFocus());
  });

  it('returns keyboard focus to New pack when creation is canceled', async () => {
    const user = userEvent.setup();
    renderPacks({ modelPacks: [everyday], defaultModelPackId: everyday.id });

    const newPack = await screen.findByRole('button', { name: 'New pack' });
    act(() => newPack.focus());
    await user.keyboard('{Enter}');
    const form = screen.getByRole('form', { name: 'New pack' });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(within(form).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'New pack' })).toHaveFocus();
  });

  it('turns the first model picked into the default pack', async () => {
    const user = userEvent.setup();
    const { client, puts } = renderPacks({ modelPacks: [], defaultModelPackId: null }, 'openai/gpt-4o-mini');

    expect(await screen.findByText(/No model packs yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New pack' })).not.toBeInTheDocument();
    await pickPackModel(user, 'Choose a model', 'GPT-5');
    await waitForMutationsIdle(client);

    expect(puts).toEqual([
      {
        modelPacks: [
          { id: 'default', name: 'Default', models: [{ modelId: 'openai/gpt-5', thinkingLevel: expect.any(String) }] },
        ],
        defaultModelPackId: 'default',
      },
    ]);
    const defaultPack = await screen.findByRole('list', { name: 'Default pack' });
    await waitFor(() => expect(within(defaultPack).getByRole('listitem', { name: 'Default' })).toHaveFocus());
  });

  it('asks for a model before saving a pack', async () => {
    const user = userEvent.setup();
    const { puts } = renderPacks({ modelPacks: [everyday], defaultModelPackId: everyday.id });

    await user.click(await screen.findByRole('button', { name: 'New pack' }));
    const form = screen.getByRole('form', { name: 'New pack' });
    await user.type(within(form).getByRole('textbox', { name: 'Name' }), 'Deep');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByText('Choose a model before saving.')).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('warns when no connected account can run the default pack model', async () => {
    renderPacks({
      modelPacks: [
        { id: 'gone', name: 'Gone', models: [{ modelId: 'google/gemini-2.5-pro', thinkingLevel: 'medium' }] },
      ],
      defaultModelPackId: 'gone',
    });

    expect(await screen.findByText(/None of your connected accounts can run/)).toBeInTheDocument();
  });

  it('names the model sessions start on when there are no packs', async () => {
    renderPacks({ modelPacks: [], defaultModelPackId: null }, 'openai/gpt-5');

    expect(await screen.findByText(/New sessions start on GPT-5, with no fallbacks/)).toBeInTheDocument();
  });

  it('asks for a pack when no start model is available', async () => {
    renderPacks({ modelPacks: [], defaultModelPackId: null }, null);

    expect(await screen.findByText(/no start model is available here/)).toBeInTheDocument();
  });
});
