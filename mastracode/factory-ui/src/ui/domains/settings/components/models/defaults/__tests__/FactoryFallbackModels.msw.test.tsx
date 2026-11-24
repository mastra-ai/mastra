import { formatModelName } from '@mastra/playground-ui/utils/model';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PathParams } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { FactoryProjectPayload } from '../../../../../workspaces/services/github';
import { FactoryFallbackModels } from '../FactoryFallbackModels';
import { FactoryThinkingControl } from '../FactoryThinkingControl';
import { pickModel } from './default-model-test-utils';
import {
  FACTORY_URL,
  GEMINI,
  GPT,
  GROK,
  ORDERED_EDITS,
  PRIMARY,
  editFallbacks,
  expectFallbackOrder,
  gate,
  stubCatalog,
  stubFactory,
  typeIntoAddFallback,
} from './fallback-models-test-utils';

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

  it('keeps a fallback addition still saving when a thinking level change fails', async () => {
    const firstAddition = gate();
    const fallbackBodies: unknown[] = [];
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
          return HttpResponse.json({ error: 'unavailable', message: 'Thinking level not saved' }, { status: 500 });
        }
        fallbackBodies.push(body);
        if (fallbackBodies.length === 1) await firstAddition.opened;
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

    await pickModel(user, 'Add fallback', GEMINI);
    await waitFor(() => expect(fallbackBodies).toEqual([{ fallbackModelIds: [GPT, GEMINI] }]));
    await user.click(screen.getByRole('button', { name: 'Thinking: Off' }));
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.pointerUp(ramp);
    fireEvent.blur(ramp);
    await waitFor(() => expect(client.isMutating()).toBe(1));
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expectFallbackOrder([GPT, GEMINI]);

    await pickModel(user, 'Add fallback', GROK);
    firstAddition.open();
    await waitForMutationsIdle(client);

    expect(fallbackBodies).toEqual([{ fallbackModelIds: [GPT, GEMINI] }, { fallbackModelIds: [GPT, GEMINI, GROK] }]);
    expectFallbackOrder([GPT, GEMINI, GROK]);
  });
});
