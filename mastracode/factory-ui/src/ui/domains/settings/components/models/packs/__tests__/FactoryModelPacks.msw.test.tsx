import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { MODEL_PACKS_MAX } from '@mastra/factory/model-packs';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import type { FactoryProjectPayload } from '../../../../../workspaces/services/github';
import { pickModel } from '../../defaults/__tests__/default-model-test-utils';
import { FactoryModelPacks } from '../FactoryModelPacks';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_ID = 'fp-1';
const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
  { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true },
];
const build: ModelPack = {
  id: 'build',
  name: 'Build',
  models: [{ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'high' }],
};
const quick: ModelPack = {
  id: 'quick',
  name: 'Quick',
  models: [{ modelId: 'openai/gpt-4o-mini', thinkingLevel: 'low' }],
};

interface StubOptions {
  packSet: ModelPackSet;
  orgKeyAdmin?: boolean;
  patchStatus?: number;
}

function renderPacks({ packSet, orgKeyAdmin = true, patchStatus }: StubOptions) {
  const patches: unknown[] = [];
  let project: FactoryProjectPayload = {
    id: FACTORY_ID,
    name: 'Mastra',
    modelScope: 'factory',
    defaultThinkingLevel: 'medium',
    ...packSet,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [], orgKeyAdmin })),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () => HttpResponse.json({ project })),
    http.patch<never, ModelPackSet>(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, async ({ request }) => {
      const body = await request.json();
      patches.push(body);
      if (patchStatus) return HttpResponse.json({ error: 'forbidden' }, { status: patchStatus });
      project = { ...project, ...body };
      return HttpResponse.json({ project });
    }),
  );
  const rendered = renderWithProviders(
    <MemoryRouter>
      <FactoryModelPacks factoryId={FACTORY_ID} />
    </MemoryRouter>,
  );
  return { ...rendered, patches };
}

async function packRow(name: string) {
  const list = await screen.findByRole('list', { name: 'Factory model packs' });
  return within(list).getByRole('listitem', { name });
}

describe('FactoryModelPacks', () => {
  it('shows each pack’s primary model and thinking level inline and marks the default', async () => {
    renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    const buildRow = await packRow('Build');
    expect(within(buildRow).getByText('Default')).toBeInTheDocument();
    expect(within(buildRow).getByRole('combobox', { name: 'Primary model' })).toHaveTextContent('Claude Sonnet 4.6');
    expect(within(buildRow).getByRole('combobox', { name: 'Primary model thinking' })).toHaveTextContent('High');
    const quickRow = await packRow('Quick');
    expect(within(quickRow).queryByText('Default')).not.toBeInTheDocument();
    expect(within(quickRow).getByRole('combobox', { name: 'Primary model thinking' })).toHaveTextContent('Low');
  });

  it('shows the packs read-only to someone who is not an organization admin', async () => {
    renderPacks({ packSet: { modelPacks: [build], defaultModelPackId: build.id }, orgKeyAdmin: false });

    expect(await screen.findByText('Only organization admins can change these packs.')).toBeInTheDocument();
    const buildRow = await packRow('Build');
    expect(within(buildRow).getByText('Claude Sonnet 4.6')).toBeInTheDocument();
    expect(within(buildRow).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(buildRow).queryByRole('button', { name: 'Delete Build' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New pack' })).not.toBeInTheDocument();
  });

  it('adds, adjusts, and promotes a fallback inline without opening an editor', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build], defaultModelPackId: build.id } });

    await pickModel(user, 'Add model', 'openai/gpt-5');
    const fallback = await screen.findByRole('combobox', { name: 'Fallback 1' });
    expect(fallback).toHaveTextContent('GPT-5');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Fallback 1 thinking' }));
    await user.click(await screen.findByRole('option', { name: 'Extra high' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Fallback 1 thinking' })).toHaveTextContent('Extra high'),
    );
    await user.click(screen.getByRole('button', { name: 'Fallback 1 actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitForMutationsIdle(client);

    expect(patches).toHaveLength(3);
    expect(patches.at(-1)).toEqual({
      modelPacks: [
        {
          ...build,
          models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'xhigh' }, build.models[0]],
        },
      ],
      defaultModelPackId: build.id,
    });
    const offer = await screen.findByRole('dialog', { name: /Also switch running sessions to/ });
    await user.click(within(offer).getByRole('button', { name: 'Keep them as-is' }));
    expect(screen.getByRole('combobox', { name: 'Primary model' })).toHaveTextContent('GPT-5');
  });

  it('keeps a duplicate rename inline and saves the corrected name without changing the model', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    await user.click(await screen.findByRole('button', { name: 'Rename Build' }));
    const name = screen.getByRole('textbox', { name: 'Pack name' });
    await user.clear(name);
    await user.type(name, ' quick {Enter}');
    expect(await screen.findByText('Another pack already has this name')).toBeInTheDocument();
    expect(patches).toEqual([]);

    await user.clear(name);
    await user.type(name, ' Deep {Enter}');
    await waitForMutationsIdle(client);

    expect(patches).toEqual([{ modelPacks: [{ ...build, name: 'Deep' }, quick], defaultModelPackId: build.id }]);
    expect(within(await packRow('Deep')).getByRole('combobox', { name: 'Primary model' })).toHaveTextContent(
      'Claude Sonnet 4.6',
    );
  });

  it('makes another pack the default', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    await user.click(await screen.findByRole('button', { name: 'Make Quick the default' }));
    await waitForMutationsIdle(client);

    expect(patches).toEqual([{ modelPacks: [build, quick], defaultModelPackId: quick.id }]);
    const offer = await screen.findByRole('dialog', { name: /Also switch running sessions to/ });
    await user.click(within(offer).getByRole('button', { name: 'Keep them as-is' }));
    expect(within(await packRow('Quick')).getByText('Default')).toBeInTheDocument();
  });

  it('keeps the default pack while other packs remain, and clears the default with the last pack', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    expect(await screen.findByRole('button', { name: 'Delete Build' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete Quick' }));
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Build' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Delete Build' }));
    await waitForMutationsIdle(client);

    expect(patches).toEqual([
      { modelPacks: [build], defaultModelPackId: build.id },
      { modelPacks: [], defaultModelPackId: null },
    ]);
    expect(await screen.findByText(/No model packs yet/)).toBeInTheDocument();
  });

  it('stops offering new packs at the limit', async () => {
    const full: ModelPack[] = Array.from({ length: MODEL_PACKS_MAX }, (_, index) => ({
      id: `pack-${index}`,
      name: `Pack ${index}`,
      models: [{ modelId: 'openai/gpt-5', thinkingLevel: 'medium' }],
    }));
    renderPacks({ packSet: { modelPacks: full, defaultModelPackId: full[0].id } });

    expect(await screen.findByRole('button', { name: 'New pack' })).toBeDisabled();
    expect(screen.getByText(`Up to ${MODEL_PACKS_MAX} packs. Delete one to add another.`)).toBeInTheDocument();
  });

  it('explains a refused change inline', async () => {
    const user = userEvent.setup();
    const { client } = renderPacks({
      packSet: { modelPacks: [build, quick], defaultModelPackId: build.id },
      patchStatus: 403,
    });

    const buildRow = await packRow('Build');
    await user.click(within(buildRow).getByRole('combobox', { name: 'Add model' }));
    const option = await screen.findByRole('option', { name: /openai\/gpt-5/ });
    await user.click(option);
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only organization admins can change Factory model packs',
    );
    expect(within(buildRow).queryByRole('combobox', { name: 'Fallback 1' })).not.toBeInTheDocument();
    expect(within(buildRow).getByRole('combobox', { name: 'Add model' })).toBeEnabled();
  });
});
