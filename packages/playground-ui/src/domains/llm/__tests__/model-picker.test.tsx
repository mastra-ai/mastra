// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelPicker } from '../model-picker';
import type { ModelPickerProps } from '../model-picker';
import type { ModelPickerProvider } from '../model-picker-types';

const anthropic: ModelPickerProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  models: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
  ],
};
const openai: ModelPickerProvider = { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: 'GPT-5' }] };

function openPicker(providers: ModelPickerProvider[], { defaultModel }: Pick<ModelPickerProps, 'defaultModel'> = {}) {
  render(
    <ModelPicker
      providers={providers}
      defaultModel={defaultModel}
      value={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      onValueChange={() => {}}
      renderProviderIcon={id => <span data-testid={`icon-${id}`} />}
      addProvider={{ label: 'Connect a provider', render: <a href="#connect" /> }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Claude Sonnet 4\.6/ }));
  return screen.getByRole('listbox');
}

describe('ModelPicker', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView ??= () => {};
    // cmdk measures its list.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('given one provider, lists its models with no provider filter or heading, and keeps connect beside search', () => {
    const list = openPicker([anthropic]);

    expect(
      within(list)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6']);
    for (const option of within(list).getAllByRole('option')) {
      expect(within(option).getByTestId('icon-anthropic')).toBeTruthy();
    }
    expect(screen.queryByRole('group', { name: 'Filter by provider' })).toBeNull();
    expect(within(list).queryByText('Anthropic')).toBeNull();

    const search = screen.getByPlaceholderText('Search models');
    const connect = screen.getByRole('link', { name: 'Connect a provider' });
    expect(search.parentElement?.contains(connect)).toBe(true);
    expect(connect.getAttribute('href')).toBe('#connect');
  });

  it('given several providers, filters by provider and heads each group until one is picked', () => {
    const list = openPicker([anthropic, openai]);

    expect(within(list).getByText('Anthropic')).toBeTruthy();
    expect(within(list).getByText('OpenAI')).toBeTruthy();

    const filter = screen.getByRole('group', { name: 'Filter by provider' });
    fireEvent.click(within(filter).getByRole('button', { name: 'OpenAI' }));

    expect(
      within(list)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['GPT-5']);
    expect(within(list).queryByText('OpenAI')).toBeNull();
  });

  it('given raw catalog ids, shows formatted names newest first and marks the default model', () => {
    const list = openPicker(
      [
        {
          id: 'anthropic',
          name: 'Anthropic',
          models: [
            { id: 'claude-sonnet-4-6', releaseDate: '2026-02-17' },
            { id: 'claude-haiku-4-5' },
            { id: 'claude-opus-4-7', releaseDate: '2026-04-16' },
          ],
        },
      ],
      { defaultModel: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
    );

    expect(
      within(list)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6Default', 'Claude Haiku 4.5']);
  });

  it('given several providers, leads every row with its own provider logo', () => {
    const list = openPicker([
      anthropic,
      openai,
      { id: 'openrouter', name: 'OpenRouter', models: [{ id: 'anthropic/claude-sonnet-4-6' }] },
    ]);

    expect(
      within(list)
        .getAllByRole('option')
        .map(option => [
          option.textContent,
          option.querySelector('[data-testid^="icon-"]')?.getAttribute('data-testid'),
        ]),
    ).toEqual([
      ['Claude Opus 4.7', 'icon-anthropic'],
      ['Claude Sonnet 4.6', 'icon-anthropic'],
      ['GPT-5', 'icon-openai'],
      ['Claude Sonnet 4.6', 'icon-openrouter'],
    ]);
  });
});
