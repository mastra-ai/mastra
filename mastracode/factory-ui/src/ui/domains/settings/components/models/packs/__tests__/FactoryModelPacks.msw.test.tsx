import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { MODEL_PACKS_MAX } from '@mastra/factory/model-packs';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import type { FactoryProjectPayload } from '../../../../../workspaces/services/github';
import { FactoryModelPacks } from '../FactoryModelPacks';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_ID = 'fp-1';
const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
  { id: 'openai/gpt-5.5', provider: 'openai', modelName: 'gpt-5.5', hasApiKey: true },
  { id: 'openai-codex/gpt-5.5', provider: 'openai-codex', modelName: 'gpt-5.5', hasApiKey: true },
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
  const list = await screen.findByRole('group', { name: 'Factory model packs' });
  return within(list).getByRole('listitem', { name });
}

async function choosePackAction(user: ReturnType<typeof userEvent.setup>, pack: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `${pack} actions` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
}

describe('FactoryModelPacks', () => {
  it('shows the default pack inline and only reveals other packs on request', async () => {
    const user = userEvent.setup();
    renderPacks({ packSet: { modelPacks: [quick, build], defaultModelPackId: build.id } });

    const defaultList = await screen.findByRole('list', { name: 'Default pack' });
    expect(
      within(defaultList).getByRole('button', { name: 'Primary model: Claude Sonnet 4.6, thinking: High' }),
    ).toBeInTheDocument();
    const otherPacks = screen.getByRole('button', { name: 'Other packs (1)' });
    expect(otherPacks).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listitem', { name: 'Quick' })).not.toBeInTheDocument();
    await user.click(otherPacks);
    expect(otherPacks).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(await packRow('Quick')).getByRole('button', { name: 'Primary model: GPT-4o Mini, thinking: Low' }),
    ).toBeInTheDocument();
    await user.click(otherPacks);
    expect(screen.queryByRole('listitem', { name: 'Quick' })).not.toBeInTheDocument();
  });

  it('shows the packs read-only to someone who is not an organization admin', async () => {
    renderPacks({ packSet: { modelPacks: [build], defaultModelPackId: build.id }, orgKeyAdmin: false });

    expect(await screen.findByText('Only organization admins can change these packs.')).toBeInTheDocument();
    const buildRow = await packRow('Build');
    expect(within(buildRow).getByText('Claude Sonnet 4.6')).toBeInTheDocument();
    expect(within(buildRow).queryByRole('button', { name: /Primary model:/ })).not.toBeInTheDocument();
    expect(within(buildRow).queryByRole('button', { name: 'Build actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New pack' })).not.toBeInTheDocument();
  });

  it('adds, adjusts, and promotes a fallback inline without opening an editor', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build], defaultModelPackId: build.id } });

    await user.click(await screen.findByRole('button', { name: 'Add model' }));
    const newModelThinking = await screen.findByRole('slider', { name: 'Thinking' });
    fireEvent.change(newModelThinking, { target: { value: '3' } });
    fireEvent.keyUp(newModelThinking);
    expect(newModelThinking).toHaveAttribute('aria-valuetext', 'High');
    await user.type(screen.getByPlaceholderText('Search models'), 'codex GPT-5.5');
    await user.click(await screen.findByRole('option', { name: /GPT-5\.5/ }));
    await waitForMutationsIdle(client);
    expect(patches[0]).toEqual({
      modelPacks: [{ ...build, models: [build.models[0], { modelId: 'openai-codex/gpt-5.5', thinkingLevel: 'high' }] }],
      defaultModelPackId: build.id,
    });
    const fallback = await screen.findByRole('button', { name: /Fallback 1: GPT-5\.5/ });
    await waitFor(() => expect(fallback).toBeEnabled());
    await user.click(fallback);
    const thinking = await screen.findByRole('slider', { name: 'Thinking' });
    fireEvent.change(thinking, { target: { value: '4' } });
    fireEvent.keyUp(thinking);
    await waitForMutationsIdle(client);
    expect(thinking).toHaveAttribute('aria-valuetext', 'Extra high');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Fallback 1 actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitForMutationsIdle(client);

    expect(patches).toHaveLength(3);
    expect(patches.at(-1)).toEqual({
      modelPacks: [
        {
          ...build,
          models: [{ modelId: 'openai-codex/gpt-5.5', thinkingLevel: 'xhigh' }, build.models[0]],
        },
      ],
      defaultModelPackId: build.id,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primary model: GPT-5.5, thinking: Extra high' })).toBeInTheDocument();
  });

  it('renames a pack inline from its menu, keeps a duplicate name open, and returns focus to the menu', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    await choosePackAction(user, 'Build', 'Rename');
    const name = screen.getByRole('textbox', { name: 'Pack name' });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, ' quick {Enter}');
    expect(await screen.findByText('Another pack already has this name')).toBeInTheDocument();
    expect(patches).toEqual([]);

    await user.clear(name);
    await user.type(name, ' Deep {Enter}');
    await waitForMutationsIdle(client);

    expect(patches).toEqual([{ modelPacks: [{ ...build, name: 'Deep' }, quick], defaultModelPackId: build.id }]);
    expect(await screen.findByRole('button', { name: 'Deep actions' })).toHaveFocus();
  });

  it('makes another pack the default', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    await user.click(await screen.findByRole('button', { name: 'Other packs (1)' }));
    await choosePackAction(user, 'Quick', 'Make default');
    await waitForMutationsIdle(client);

    expect(patches).toEqual([{ modelPacks: [build, quick], defaultModelPackId: quick.id }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const currentDefault = await screen.findByRole('list', { name: 'Default pack' });
    expect(within(currentDefault).getByRole('listitem', { name: 'Quick' })).toBeInTheDocument();
    const otherPacks = screen.getByRole('list', { name: 'Other packs' });
    expect(within(otherPacks).getByRole('listitem', { name: 'Build' })).toBeInTheDocument();
  });

  it('keeps the default pack while other packs remain, and clears the default with the last pack', async () => {
    const user = userEvent.setup();
    const { client, patches } = renderPacks({ packSet: { modelPacks: [build, quick], defaultModelPackId: build.id } });

    await packRow('Build');
    await user.click(screen.getByRole('button', { name: 'Build actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete pack' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Other packs (1)' }));
    await choosePackAction(user, 'Quick', 'Delete pack');
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Build actions' })).toBeEnabled());
    await choosePackAction(user, 'Build', 'Delete pack');
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

  it('keeps keyboard focus on the model that fills the pack', async () => {
    const user = userEvent.setup();
    const threeModels: ModelPack = {
      ...build,
      models: [
        build.models[0],
        { modelId: 'openai/gpt-5', thinkingLevel: 'medium' },
        { modelId: 'openai/gpt-5.5', thinkingLevel: 'medium' },
      ],
    };
    const { client } = renderPacks({ packSet: { modelPacks: [threeModels], defaultModelPackId: build.id } });

    await user.click(await screen.findByRole('button', { name: 'Add model' }));
    await user.click(await screen.findByRole('option', { name: 'GPT-4o Mini' }));
    await waitForMutationsIdle(client);

    expect(screen.queryByRole('button', { name: 'Add model' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fallback 3: GPT-4o Mini/ })).toHaveFocus();
  });

  it('explains a refused change inline', async () => {
    const user = userEvent.setup();
    const { client } = renderPacks({
      packSet: { modelPacks: [build, quick], defaultModelPackId: build.id },
      patchStatus: 403,
    });

    const buildRow = await packRow('Build');
    await user.click(within(buildRow).getByRole('button', { name: 'Add model' }));
    await user.click(await screen.findByRole('option', { name: 'GPT-5' }));
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only organization admins can change Factory model packs',
    );
    expect(within(buildRow).queryByRole('button', { name: /Fallback 1:/ })).not.toBeInTheDocument();
    expect(within(buildRow).getByRole('button', { name: 'Add model' })).toBeEnabled();
  });
});
