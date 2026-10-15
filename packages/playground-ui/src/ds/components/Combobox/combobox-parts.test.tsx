// @vitest-environment jsdom
// ComboboxChips observes the field's size to round it once chips wrap.
import '@/test/inert-resize-observer';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field, FieldLabel } from '../Field';
import {
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxTrigger,
  ComboboxValue,
} from './combobox-parts';

afterEach(() => {
  cleanup();
});

type Provider = { value: string; label: string };

const openai: Provider = { label: 'OpenAI', value: 'openai' };
const anthropic: Provider = { label: 'Anthropic', value: 'anthropic' };
const google: Provider = { label: 'Google', value: 'google' };
const providers = [openai, anthropic, google];

function Items() {
  return (
    <>
      <ComboboxEmpty>No providers found.</ComboboxEmpty>
      <ComboboxList>
        {(item: Provider) => (
          <ComboboxItem key={item.value} value={item}>
            {item.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </>
  );
}

function SinglePicker({ onValueChange }: { onValueChange?: (value: Provider | null) => void }) {
  return (
    <Field>
      <FieldLabel>Provider</FieldLabel>
      <ComboboxRoot items={providers} onValueChange={onValueChange} autoHighlight>
        <ComboboxInput placeholder="Pick provider" />
        <ComboboxContent>
          <Items />
        </ComboboxContent>
      </ComboboxRoot>
    </Field>
  );
}

function MultiplePicker({
  initial,
  onValueChange,
}: {
  initial: Provider[];
  onValueChange?: (value: Provider[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ComboboxRoot
      multiple
      items={providers}
      value={value}
      onValueChange={next => {
        setValue(next);
        onValueChange?.(next);
      }}
      autoHighlight
    >
      <ComboboxChips>
        <ComboboxValue>
          {(items: Provider[]) => (
            <>
              {items.map(item => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput aria-label="Providers" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent>
        <Items />
      </ComboboxContent>
    </ComboboxRoot>
  );
}

describe('Combobox parts', () => {
  it('searches in the field: opens from the keyboard, filters as you type, selects with Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SinglePicker onValueChange={onValueChange} />);

    // The field's label names the input you type in.
    const input = screen.getByRole('combobox', { name: 'Provider' });
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('option', { name: 'Anthropic' })).toBeTruthy();

    await user.type(input, 'goo');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Anthropic' })).toBeNull();
    });
    const googleOption = screen.getByRole('option', { name: 'Google' });
    await waitFor(() => expect(googleOption.hasAttribute('data-highlighted')).toBe(true));

    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(google, expect.anything());
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('Google'));
  });

  it('says so when the search matches nothing', async () => {
    const user = userEvent.setup();
    render(<SinglePicker />);

    const input = screen.getByRole('combobox', { name: 'Provider' });
    await user.type(input, 'zzz');

    expect(await screen.findByText('No providers found.')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('closes with Escape and keeps the value', async () => {
    const user = userEvent.setup();
    render(<SinglePicker />);

    const input = screen.getByRole('combobox', { name: 'Provider' });
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: 'OpenAI' });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'OpenAI' })).toBeNull();
    });
    expect(document.activeElement).toBe(input);
  });

  it('opens the list from the chevron button at the end of the field', async () => {
    const user = userEvent.setup();
    render(<SinglePicker />);

    // Inside a Field, Base UI names the chevron after the field's label too.
    await user.click(screen.getByRole('button', { name: 'Provider' }));
    expect(await screen.findByRole('option', { name: 'OpenAI' })).toBeTruthy();
  });

  it('adds chips from the list and removes the last one with Backspace', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MultiplePicker initial={[openai]} onValueChange={onValueChange} />);

    const input = screen.getByRole('combobox', { name: 'Providers' });
    await user.type(input, 'anth');
    await screen.findByRole('option', { name: 'Anthropic' });
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenLastCalledWith([openai, anthropic]);
    expect(screen.getByRole('button', { name: 'Remove Anthropic' })).toBeTruthy();

    // The search text clears on selection, so Backspace in the empty input removes the last chip.
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    await user.keyboard('{Backspace}');
    expect(onValueChange).toHaveBeenLastCalledWith([openai]);
    expect(screen.queryByRole('button', { name: 'Remove Anthropic' })).toBeNull();
  });

  it('removes a chip with its ×', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<MultiplePicker initial={[openai, google]} onValueChange={onValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Remove OpenAI' }));
    expect(onValueChange).toHaveBeenLastCalledWith([google]);
  });

  it('opens the list at the width of the chips field, not its input', async () => {
    const user = userEvent.setup();
    render(<MultiplePicker initial={[]} />);

    await user.click(screen.getByRole('button', { name: 'Show options' }));
    const option = await screen.findByRole('option', { name: 'OpenAI' });
    const popup = option.closest('[data-slot=combobox-content]');
    expect(popup?.className).toContain('w-(--anchor-width)');
  });

  it('searches inside the popup for a compact trigger', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ComboboxRoot items={providers} defaultValue={openai} onValueChange={onValueChange} autoHighlight>
        <ComboboxTrigger size="icon-md" aria-label="Provider">
          <ComboboxValue />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxSearch placeholder="Search providers" />
          <Items />
        </ComboboxContent>
      </ComboboxRoot>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Provider' });
    // Icon sizes keep the value for assistive tech only.
    expect(trigger.querySelector('.sr-only')?.textContent).toBe('OpenAI');

    await user.click(trigger);
    const search = await screen.findByPlaceholderText('Search providers');
    await waitFor(() => expect(document.activeElement).toBe(search));

    await user.keyboard('anth');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'OpenAI' })).toBeNull();
    });
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(anthropic, expect.anything());

    // A trigger-anchored popup sizes to its content instead of the tiny trigger.
    await user.click(trigger);
    const option = await screen.findByRole('option', { name: 'Anthropic' });
    expect(option.closest('[data-slot=combobox-content]')?.className).not.toContain('w-(--anchor-width)');
  });
});
