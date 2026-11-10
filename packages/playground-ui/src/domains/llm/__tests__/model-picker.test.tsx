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
    { id: 'claude-sonnet-4-6', releaseDate: '2026-02-17' },
    { id: 'claude-opus-4-7', releaseDate: '2026-04-16' },
  ],
};
const openai: ModelPickerProvider = { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5' }] };

function openPicker(
  providers: ModelPickerProvider[],
  {
    defaultModel,
    openOnSelectedProvider,
    reset,
    onValueChange = () => {},
  }: Partial<Pick<ModelPickerProps, 'defaultModel' | 'openOnSelectedProvider' | 'reset' | 'onValueChange'>> = {},
) {
  render(
    <ModelPicker
      providers={providers}
      defaultModel={defaultModel}
      openOnSelectedProvider={openOnSelectedProvider}
      reset={reset}
      value={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      onValueChange={onValueChange}
      renderProviderIcon={id => <span data-testid={`icon-${id}`} />}
      addProvider={{ label: 'Connect a provider', render: <a href="#connect" /> }}
    />,
  );
  return reopen();
}

function reopen() {
  fireEvent.click(screen.getByRole('button', { name: /Claude Sonnet 4\.6/ }));
  return screen.getByRole('listbox');
}

const optionNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('option')
    .map(option => option.textContent);

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

    expect(optionNames(list)).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6']);
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

    expect(optionNames(list)).toEqual(['GPT-5']);
    expect(within(list).queryByText('OpenAI')).toBeNull();
  });

  it('given a provider pill, Enter on it leaves the highlighted model unpicked', () => {
    const onValueChange = vi.fn();
    openPicker([anthropic, openai], { onValueChange });

    const filter = screen.getByRole('group', { name: 'Filter by provider' });
    fireEvent.keyDown(within(filter).getByRole('button', { name: 'OpenAI' }), { key: 'Enter' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('given a reset, offers it and closes the picker once it runs', () => {
    const onClick = vi.fn();
    const list = openPicker([anthropic], { reset: { label: 'Reset to your default', onClick } });

    fireEvent.click(within(list).getByRole('option', { name: 'Reset to your default' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('given no reset, offers none even when another model than the default is picked', () => {
    const list = openPicker([anthropic], { defaultModel: { provider: 'anthropic', model: 'claude-opus-4-7' } });

    expect(within(list).queryByRole('option', { name: /Reset/ })).toBeNull();
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

    expect(optionNames(list)).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6Default', 'Claude Haiku 4.5']);
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

  it('given a search and a provider filter, starts fresh the next time it opens', () => {
    openPicker([anthropic, openai]);
    fireEvent.change(screen.getByPlaceholderText('Search models'), { target: { value: 'gpt' } });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Filter by provider' })).getByRole('button', { name: 'OpenAI' }),
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Search models'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    const list = reopen();

    expect(screen.getByPlaceholderText<HTMLInputElement>('Search models').value).toBe('');
    expect(optionNames(list)).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6', 'GPT-5']);
  });

  it("given openOnSelectedProvider, opens filtered to the selected model's provider", () => {
    const list = openPicker([anthropic, openai], { openOnSelectedProvider: true });

    expect(optionNames(list)).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6']);
    expect(
      within(screen.getByRole('group', { name: 'Filter by provider' }))
        .getByRole('button', { name: 'Anthropic' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  describe('when the catalog holds many providers that are not connected', () => {
    const offline = Array.from(
      { length: 40 },
      (_, i): ModelPickerProvider => ({
        id: `offline-${i}`,
        name: `Offline ${i}`,
        connected: false,
        models: Array.from({ length: 30 }, (_, j) => ({ id: `offline-model-${i}-${j}` })),
      }),
    );
    const groq: ModelPickerProvider = { id: 'groq', name: 'Groq', connected: false, models: [{ id: 'llama-4-scout' }] };
    const catalog = [{ ...anthropic, connected: true }, { ...openai, connected: true }, groq, ...offline];

    it('lists connected providers first and counts the rest behind one button', () => {
      const list = openPicker(catalog);

      expect(optionNames(list)).toEqual(['Claude Opus 4.7', 'Claude Sonnet 4.6', 'GPT-5']);
      expect(
        within(screen.getByRole('group', { name: 'Filter by provider' }))
          .getAllByRole('button')
          .map(button => button.getAttribute('aria-label') ?? button.textContent),
      ).toEqual(['All', 'Anthropic', 'OpenAI', '41 more providers']);
    });

    it('browses the other providers and opens the models of the one picked', () => {
      const list = openPicker(catalog);

      fireEvent.click(screen.getByRole('button', { name: '41 more providers' }));
      expect(optionNames(list)).toHaveLength(41);
      fireEvent.click(within(list).getByRole('option', { name: /Groq/ }));

      expect(optionNames(list)).toEqual(['Llama 4 Scout']);
      expect(screen.getByRole('button', { name: 'Groq, not connected' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('searches every provider and caps the matches it renders', () => {
      const list = openPicker(catalog);

      fireEvent.change(screen.getByPlaceholderText('Search models'), { target: { value: 'offline model' } });

      expect(within(list).getAllByRole('option')).toHaveLength(50);
      expect(within(list).getByText('Refine the search to see more.')).toBeTruthy();
    });

    it('finds a provider that is not connected by its name', () => {
      const list = openPicker(catalog);

      fireEvent.change(screen.getByPlaceholderText('Search models'), { target: { value: 'groq' } });

      expect(optionNames(list)).toEqual(['Llama 4 Scout']);
    });
  });
});
