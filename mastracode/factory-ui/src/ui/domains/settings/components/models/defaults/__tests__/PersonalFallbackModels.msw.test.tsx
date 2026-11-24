import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import { PersonalFallbackModels } from '../PersonalFallbackModels';
import {
  GEMINI,
  GPT,
  GROK,
  ORDERED_EDITS,
  PRIMARY,
  editFallbacks,
  expectFallbackOrder,
  gate,
  stubPersonal,
} from './fallback-models-test-utils';

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
