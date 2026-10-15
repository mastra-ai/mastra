// @vitest-environment jsdom
// ComboboxChips observes the field's size to round it once chips wrap.
import '@/test/inert-resize-observer';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field, FieldLabel } from '../Field';
import {
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
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

const groups = [
  { value: 'Hosted', items: [openai, anthropic] },
  { value: 'Cloud', items: [google] },
];

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

/** A field you search in, as a form uses it; uncontrolled, starting from `defaultValue`. */
function SearchField({
  disabled,
  defaultValue,
  onValueChange,
}: {
  disabled?: boolean;
  defaultValue?: Provider;
  onValueChange?: (value: Provider | null) => void;
}) {
  return (
    <Field>
      <FieldLabel>Provider</FieldLabel>
      <ComboboxRoot
        items={providers}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxInput placeholder="Pick provider" />
        <ComboboxContent>
          <Items />
        </ComboboxContent>
      </ComboboxRoot>
    </Field>
  );
}

function ControlledSearchField({ initial }: { initial: Provider }) {
  const [value, setValue] = useState<Provider | null>(initial);
  return (
    <>
      <button type="button" onClick={() => setValue(google)}>
        Use Google
      </button>
      <Field>
        <FieldLabel>Provider</FieldLabel>
        <ComboboxRoot items={providers} value={value} onValueChange={setValue} autoHighlight>
          <ComboboxInput />
          <ComboboxContent>
            <Items />
          </ComboboxContent>
        </ComboboxRoot>
      </Field>
    </>
  );
}

function GroupedField() {
  return (
    <Field>
      <FieldLabel>Provider</FieldLabel>
      <ComboboxRoot items={groups} autoHighlight>
        <ComboboxInput />
        <ComboboxContent>
          <ComboboxEmpty>No providers found.</ComboboxEmpty>
          <ComboboxList>
            {(group: (typeof groups)[number]) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item: Provider) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </Field>
  );
}

function ChipsField({
  initial,
  disabled,
  onValueChange,
}: {
  initial: Provider[];
  disabled?: boolean;
  onValueChange?: (value: Provider[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ComboboxRoot
      multiple
      items={providers}
      value={value}
      disabled={disabled}
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

function CompactPicker({ onValueChange }: { onValueChange?: (value: Provider | null) => void }) {
  return (
    <ComboboxRoot items={providers} defaultValue={openai} onValueChange={onValueChange} autoHighlight>
      <ComboboxTrigger size="icon-md" aria-label="Provider">
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder="Search providers" />
        <Items />
      </ComboboxContent>
    </ComboboxRoot>
  );
}

const field = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Provider' });
const optionNames = () => screen.queryAllByRole('option').map(option => option.textContent);
// While the list is open, Base UI hides everything outside it from assistive tech, the chips included.
const chipNames = () =>
  screen.queryAllByRole('button', { name: /^Remove /, hidden: true }).map(button => button.getAttribute('aria-label'));

describe('Combobox parts', () => {
  describe('when the search is in the field', () => {
    it('focuses the field when its label is clicked', async () => {
      render(<SearchField />);

      await userEvent.click(screen.getByText('Provider'));

      expect(document.activeElement).toBe(field());
    });

    it('opens from the keyboard, filters as you type and selects with Enter', async () => {
      const onValueChange = vi.fn();
      render(<SearchField onValueChange={onValueChange} />);
      const user = userEvent.setup();

      field().focus();
      await user.keyboard('{ArrowDown}');
      await screen.findByRole('option', { name: 'Anthropic' });
      await user.keyboard('goo');
      await waitFor(() => expect(optionNames()).toEqual(['Google']));
      await user.keyboard('{Enter}');

      expect(onValueChange).toHaveBeenCalledWith(google, expect.anything());
      await waitFor(() => expect(field().value).toBe('Google'));
    });

    it('opens from the chevron at the end of the field', async () => {
      render(<SearchField />);

      // Inside a Field, Base UI names the chevron after the field's label too.
      await userEvent.click(screen.getByRole('button', { name: 'Provider' }));

      expect(await screen.findByRole('option', { name: 'OpenAI' })).toBeTruthy();
    });

    it('closes with Escape and keeps the value and focus', async () => {
      render(<SearchField defaultValue={openai} />);
      const user = userEvent.setup();

      await user.click(field());
      await screen.findAllByRole('option');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
      expect(document.activeElement).toBe(field());
      expect(field().value).toBe('OpenAI');
    });

    it('says so when the search matches nothing', async () => {
      render(<SearchField />);

      await userEvent.type(field(), 'zzz');

      expect(await screen.findByText('No providers found.')).toBeTruthy();
      expect(screen.queryByRole('option')).toBeNull();
    });

    it('puts the caret at the end of the value on focus instead of selecting it', async () => {
      render(<SearchField defaultValue={anthropic} />);

      await userEvent.click(field());

      await waitFor(() => expect(field().selectionStart).toBe('Anthropic'.length));
      expect(field().selectionEnd).toBe('Anthropic'.length);
    });
  });

  describe('when the root is uncontrolled', () => {
    it('starts from defaultValue and keeps the pick', async () => {
      render(<SearchField defaultValue={openai} />);
      const user = userEvent.setup();

      expect(field().value).toBe('OpenAI');
      await user.click(field());
      await user.click(await screen.findByRole('option', { name: 'Anthropic' }));

      await waitFor(() => expect(field().value).toBe('Anthropic'));
    });
  });

  describe('when the root is controlled', () => {
    it('follows the value its owner sets', async () => {
      render(<ControlledSearchField initial={openai} />);

      await userEvent.click(screen.getByRole('button', { name: 'Use Google' }));

      await waitFor(() => expect(field().value).toBe('Google'));
    });
  });

  describe('when items are grouped', () => {
    it('lists each group under its label', async () => {
      render(<GroupedField />);

      await userEvent.click(field());

      const hosted = await screen.findByRole('group', { name: 'Hosted' });
      const cloud = screen.getByRole('group', { name: 'Cloud' });
      expect(
        within(hosted)
          .getAllByRole('option')
          .map(option => option.textContent),
      ).toEqual(['OpenAI', 'Anthropic']);
      expect(
        within(cloud)
          .getAllByRole('option')
          .map(option => option.textContent),
      ).toEqual(['Google']);
    });

    it('drops a group whose items the search filters out', async () => {
      render(<GroupedField />);
      const user = userEvent.setup();

      await user.click(field());
      await user.keyboard('goo');

      await waitFor(() => expect(screen.queryByRole('group', { name: 'Hosted' })).toBeNull());
      expect(screen.getByRole('group', { name: 'Cloud' })).toBeTruthy();
      expect(optionNames()).toEqual(['Google']);
    });
  });

  describe('when the field shows chips', () => {
    const chipsInput = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Providers' });

    it('adds a chip for each pick', async () => {
      const onValueChange = vi.fn();
      render(<ChipsField initial={[openai]} onValueChange={onValueChange} />);
      const user = userEvent.setup();

      await user.type(chipsInput(), 'anth');
      await screen.findByRole('option', { name: 'Anthropic' });
      await user.keyboard('{Enter}');

      expect(onValueChange).toHaveBeenLastCalledWith([openai, anthropic]);
      expect(chipNames()).toEqual(['Remove OpenAI', 'Remove Anthropic']);
    });

    it('clears the search after a pick, so Backspace then removes the last chip', async () => {
      render(<ChipsField initial={[openai]} />);
      const user = userEvent.setup();

      await user.type(chipsInput(), 'anth');
      await screen.findByRole('option', { name: 'Anthropic' });
      await user.keyboard('{Enter}');
      await waitFor(() => expect(chipsInput().value).toBe(''));
      await user.keyboard('{Backspace}');

      expect(chipNames()).toEqual(['Remove OpenAI']);
    });

    it('removes a chip with its ×', async () => {
      const onValueChange = vi.fn();
      render(<ChipsField initial={[openai, google]} onValueChange={onValueChange} />);

      await userEvent.click(screen.getByRole('button', { name: 'Remove OpenAI' }));

      expect(onValueChange).toHaveBeenLastCalledWith([google]);
    });

    it('keeps its chips while disabled', async () => {
      render(<ChipsField initial={[openai]} disabled />);

      await userEvent.click(screen.getByRole('button', { name: 'Remove OpenAI' }));

      expect(chipNames()).toEqual(['Remove OpenAI']);
      expect(chipsInput().disabled).toBe(true);
    });
  });

  describe('when the field is disabled', () => {
    it('does not open', async () => {
      render(<SearchField disabled />);

      await userEvent.click(field());

      expect(field().disabled).toBe(true);
      expect(screen.queryByRole('option')).toBeNull();
    });
  });

  describe('when a compact trigger keeps the search in the popup', () => {
    const trigger = () => screen.getByRole('combobox', { name: 'Provider' });

    it('keeps the value for assistive tech on an icon trigger', () => {
      render(<CompactPicker />);

      expect(trigger().textContent).toContain('OpenAI');
    });

    it('moves focus into the popup search when opened', async () => {
      render(<CompactPicker />);

      await userEvent.click(trigger());
      const search = await screen.findByPlaceholderText('Search providers');

      await waitFor(() => expect(document.activeElement).toBe(search));
    });

    it('filters as you type and selects with Enter', async () => {
      const onValueChange = vi.fn();
      render(<CompactPicker onValueChange={onValueChange} />);
      const user = userEvent.setup();

      await user.click(trigger());
      const search = await screen.findByPlaceholderText('Search providers');
      await waitFor(() => expect(document.activeElement).toBe(search));
      await user.keyboard('anth');
      await waitFor(() => expect(optionNames()).toEqual(['Anthropic']));
      await user.keyboard('{Enter}');

      expect(onValueChange).toHaveBeenCalledWith(anthropic, expect.anything());
    });

    it('closes with Escape', async () => {
      render(<CompactPicker />);
      const user = userEvent.setup();

      await user.click(trigger());
      await screen.findAllByRole('option');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
    });
  });
});
