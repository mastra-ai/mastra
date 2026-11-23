import { formatModelName } from '@mastra/playground-ui/utils/model';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PathParams } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { DefaultModelResponse } from '../../../../../../../api/types';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import type { FactoryProjectPayload } from '../../../../../workspaces/services/github';
import { FactoryFallbackModels } from '../FactoryDefaultModel';
import { FactoryThinkingControl } from '../FactoryThinkingControl';
import { PersonalFallbackModels } from '../PersonalDefaultModelPicker';
import { pickModel } from './default-model-test-utils';

const FACTORY_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const DEFAULT_MODEL_URL = `${TEST_BASE_URL}/web/config/default-model`;
const PRIMARY = 'anthropic/claude-opus-5.5';
const GPT = 'openai/gpt-5.6-sol';
const GEMINI = 'google/gemini-3.8-flash';
const GROK = 'xai/grok-5';

const models: AvailableModelOption[] = [
  { id: PRIMARY, provider: 'anthropic', modelName: 'claude-opus-5.5', hasApiKey: true },
  { id: GPT, provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
  { id: GEMINI, provider: 'google', modelName: 'gemini-3.8-flash', hasApiKey: true },
  { id: GROK, provider: 'xai', modelName: 'grok-5', hasApiKey: true },
];

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return { opened, open };
}

function stubCatalog() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models, fallbackModelId: null })),
  );
}

function stubFactory(fallbackModelIds: string[], gates: Promise<void>[] = []) {
  const patchedBodies: unknown[] = [];
  let saved = fallbackModelIds;
  const project = (): FactoryProjectPayload => ({
    id: 'fp-1',
    name: 'Mastra',
    defaultModelId: PRIMARY,
    fallbackModelIds: saved,
  });
  stubCatalog();
  server.use(
    http.get(FACTORY_URL, () => HttpResponse.json({ project: project() })),
    http.patch<PathParams, { fallbackModelIds: string[] }>(FACTORY_URL, async ({ request }) => {
      const body = await request.json();
      patchedBodies.push(body);
      await gates[patchedBodies.length - 1];
      saved = body.fallbackModelIds;
      return HttpResponse.json({ project: project() });
    }),
  );
  return { patchedBodies };
}

function stubPersonal(defaults: DefaultModelResponse, gates: Promise<void>[] = []) {
  const putBodies: unknown[] = [];
  let saved = defaults;
  stubCatalog();
  server.use(
    http.get(DEFAULT_MODEL_URL, () => HttpResponse.json(saved)),
    http.put<PathParams, { fallbackModelIds: string[] }>(`${DEFAULT_MODEL_URL}/fallbacks`, async ({ request }) => {
      const body = await request.json();
      putBodies.push(body);
      await gates[putBodies.length - 1];
      saved = { ...saved, fallbackModelIds: body.fallbackModelIds };
      return HttpResponse.json({ fallbackModelIds: body.fallbackModelIds });
    }),
  );
  return { putBodies };
}

async function typeIntoAddFallback(user: UserEvent, text: string) {
  const add = await screen.findByRole('combobox', { name: 'Add fallback' });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
  await user.type(await screen.findByPlaceholderText('Search models'), text);
  const custom = await screen.findByRole('option', { name: `Use “${text}”` });
  fireEvent.pointerDown(custom, { pointerType: 'mouse' });
  fireEvent.click(custom, { detail: 1 });
}

function expectFallbackOrder(ids: string[]) {
  expect(screen.getAllByRole('combobox', { name: /^Fallback model/ })).toHaveLength(ids.length);
  ids.forEach((id, index) =>
    expect(screen.getByRole('combobox', { name: `Fallback model ${index + 1}` })).toHaveTextContent(
      formatModelName(id),
    ),
  );
}

async function editFallbacks(user: UserEvent, client: Parameters<typeof waitForMutationsIdle>[0]) {
  const announcements: string[] = [];
  const announced = async () => {
    await waitForMutationsIdle(client);
    announcements.push(screen.getByRole('status').textContent ?? '');
  };
  await pickModel(user, 'Add fallback', GPT);
  await announced();
  await pickModel(user, 'Add fallback', GEMINI);
  await announced();
  await user.click(await screen.findByRole('button', { name: 'Move fallback 2 up' }));
  await announced();
  await user.click(screen.getByRole('button', { name: 'Remove fallback 1' }));
  await announced();
  return announcements;
}

const ORDERED_EDITS = [
  { fallbackModelIds: [GPT] },
  { fallbackModelIds: [GPT, GEMINI] },
  { fallbackModelIds: [GEMINI, GPT] },
  { fallbackModelIds: [GPT] },
];

describe('Factory fallback models', () => {
  it('saves each add, reorder and removal as the full ordered list', async () => {
    const { patchedBodies } = stubFactory([]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    const announcements = await editFallbacks(user, client);

    expect(patchedBodies).toEqual(ORDERED_EDITS);
    expectFallbackOrder([GPT]);
    expect(screen.getByRole('combobox', { name: 'Fallback model 1' })).toHaveFocus();
    expect(announcements).toEqual([
      `${formatModelName(GPT)} added as fallback 1`,
      `${formatModelName(GEMINI)} added as fallback 2`,
      `${formatModelName(GEMINI)} moved to position 1`,
      `${formatModelName(GEMINI)} removed`,
    ]);
  });

  it('does not offer the default model, or a model already in the list, as a fallback', async () => {
    stubFactory([GPT]);
    const user = userEvent.setup();
    renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    const add = await screen.findByRole('combobox', { name: 'Add fallback' });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      expect.stringContaining(GEMINI),
      expect.stringContaining(GROK),
    ]);
  });

  it('adds the first matching model when a search is submitted with Enter', async () => {
    const { patchedBodies } = stubFactory([]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    const add = await screen.findByRole('combobox', { name: 'Add fallback' });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);
    await user.type(await screen.findByPlaceholderText('Search models'), 'gemini{Enter}');
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ fallbackModelIds: [GEMINI] }]);
    expectFallbackOrder([GEMINI]);
  });

  it.each([
    ['the default model', PRIMARY],
    ['a model already in the list', GPT],
  ])('ignores %s typed in as a fallback', async (_label, typed) => {
    const { patchedBodies } = stubFactory([GPT]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    await typeIntoAddFallback(user, typed);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([]);
    expectFallbackOrder([GPT]);
  });

  it('adds nothing when the add popup is dismissed', async () => {
    const { patchedBodies } = stubFactory([]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    const add = await screen.findByRole('combobox', { name: 'Add fallback' });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([]);
    expect(screen.queryAllByRole('combobox', { name: /^Fallback model/ })).toEqual([]);
    expect(screen.getByRole('combobox', { name: 'Add fallback' })).toBeEnabled();
  });

  it('stays editable while a save is in flight', async () => {
    const save = gate();
    const { patchedBodies } = stubFactory([], [save.opened]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    await pickModel(user, 'Add fallback', GPT);
    await waitFor(() => expect(patchedBodies).toEqual([{ fallbackModelIds: [GPT] }]));

    expectFallbackOrder([GPT]);
    expect(screen.getByRole('combobox', { name: 'Fallback model 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove fallback 1' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Add fallback' })).toBeEnabled();

    save.open();
    await waitForMutationsIdle(client);
    expectFallbackOrder([GPT]);
  });

  it('says why no other fallback can be added once three are set', async () => {
    stubFactory([GPT, GEMINI, GROK]);
    renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    expect(await screen.findByText('Up to 3 fallbacks')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add fallback' })).not.toBeInTheDocument();
  });

  it('flags a saved fallback the current keys cannot run', async () => {
    stubFactory(['mistral/mistral-large-3']);
    renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    expect(await screen.findByText('Not available with your current keys; skipped during runs')).toBeInTheDocument();
  });

  it('flags a saved fallback that is now the default model', async () => {
    stubFactory([PRIMARY]);
    renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    expect(await screen.findByText('Already the default model')).toBeInTheDocument();
  });

  it('keeps focus on a fallback whose model was replaced and announces it', async () => {
    const { patchedBodies } = stubFactory([GPT, GEMINI]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactoryFallbackModels factoryId="fp-1" />);

    await pickModel(user, 'Fallback model 1', GROK);
    await waitForMutationsIdle(client);

    expect(patchedBodies).toEqual([{ fallbackModelIds: [GROK, GEMINI] }]);
    expectFallbackOrder([GROK, GEMINI]);
    expect(screen.getByRole('combobox', { name: 'Fallback model 1' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(`${formatModelName(GROK)} is now fallback 1`);
  });

  it('keeps a saved fallback edit when a thinking level change fails', async () => {
    const thinkingSave = gate();
    let thinkingRequested = false;
    let savedFallbacks = [GPT];
    const project = (): FactoryProjectPayload => ({
      id: 'fp-1',
      name: 'Mastra',
      defaultModelId: PRIMARY,
      defaultThinkingLevel: 'off',
      fallbackModelIds: savedFallbacks,
    });
    stubCatalog();
    server.use(
      http.get(FACTORY_URL, () => HttpResponse.json({ project: project() })),
      http.patch<PathParams, { fallbackModelIds?: string[] }>(FACTORY_URL, async ({ request }) => {
        const body = await request.json();
        if (!body.fallbackModelIds) {
          thinkingRequested = true;
          await thinkingSave.opened;
          return HttpResponse.json({ error: 'unavailable', message: 'Thinking level not saved' }, { status: 500 });
        }
        savedFallbacks = body.fallbackModelIds;
        return HttpResponse.json({ project: project() });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <>
        <FactoryThinkingControl factoryId="fp-1" />
        <FactoryFallbackModels factoryId="fp-1" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'Thinking: Off' }));
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.pointerUp(ramp);
    fireEvent.blur(ramp);
    await waitFor(() => expect(thinkingRequested).toBe(true));

    await pickModel(user, 'Add fallback', GEMINI);
    await waitFor(() => expect(savedFallbacks).toEqual([GPT, GEMINI]));
    thinkingSave.open();
    await waitForMutationsIdle(client);

    expectFallbackOrder([GPT, GEMINI]);
  });
});

describe('Personal fallback models', () => {
  it('saves each add, reorder and removal to the personal defaults', async () => {
    const { putBodies } = stubPersonal({ modelId: PRIMARY, thinkingLevel: null, fallbackModelIds: [] });
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PersonalFallbackModels />);

    await editFallbacks(user, client);

    expect(putBodies).toEqual(ORDERED_EDITS);
    expectFallbackOrder([GPT]);
  });

  it('keeps the newest order on screen when an older save answers after a newer edit', async () => {
    const first = gate();
    const second = gate();
    const { putBodies } = stubPersonal(
      { modelId: PRIMARY, thinkingLevel: null, fallbackModelIds: [GPT, GEMINI, GROK] },
      [first.opened, second.opened],
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PersonalFallbackModels />);

    await user.click(await screen.findByRole('button', { name: 'Move fallback 1 down' }));
    await waitFor(() => expectFallbackOrder([GEMINI, GPT, GROK]));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move fallback 2 down' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Move fallback 2 down' }));
    await waitFor(() => expectFallbackOrder([GEMINI, GROK, GPT]));

    first.open();
    await waitFor(() => expect(putBodies).toHaveLength(2));
    expectFallbackOrder([GEMINI, GROK, GPT]);

    second.open();
    await waitForMutationsIdle(client);

    expect(putBodies).toEqual([{ fallbackModelIds: [GEMINI, GPT, GROK] }, { fallbackModelIds: [GEMINI, GROK, GPT] }]);
    expectFallbackOrder([GEMINI, GROK, GPT]);
  });

  it('asks for a default model before offering fallbacks', async () => {
    stubPersonal({ modelId: null, thinkingLevel: null, fallbackModelIds: [] });
    renderWithProviders(<PersonalFallbackModels />);

    expect(await screen.findByText('Pick a default model first')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add fallback' })).not.toBeInTheDocument();
  });

  it('keeps focus in the fallback list when the last fallback is removed and none can be added', async () => {
    const { putBodies } = stubPersonal({ modelId: null, thinkingLevel: null, fallbackModelIds: [GPT] });
    const user = userEvent.setup();
    const { client } = renderWithProviders(<PersonalFallbackModels />);

    const remove = await screen.findByRole('button', { name: 'Remove fallback 1' });
    await waitFor(() => expect(remove).toBeEnabled());
    await user.click(remove);
    await waitForMutationsIdle(client);

    expect(putBodies).toEqual([{ fallbackModelIds: [] }]);
    expect(screen.queryAllByRole('combobox', { name: /^Fallback model/ })).toEqual([]);
    expect(screen.getByRole('group', { name: 'Fallback models' })).toHaveFocus();
  });
});
