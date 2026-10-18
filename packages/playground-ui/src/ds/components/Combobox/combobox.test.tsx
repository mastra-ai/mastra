// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field, FieldError, FieldLabel } from '../Field';
import { Form } from '../Form';
import { Combobox } from './combobox';
import type { ComboboxMultipleProps, ComboboxOption, ComboboxSingleProps } from './combobox';

afterEach(() => {
  cleanup();
});

const providers: ComboboxOption[] = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google', value: 'google' },
];

function InField({ children }: { children: ReactNode }) {
  return (
    <Field>
      <FieldLabel>Provider</FieldLabel>
      {children}
    </Field>
  );
}

/** A single-select Combobox in a form field whose value the test (like a real caller) owns. */
function SingleField({ initial, ...props }: Partial<ComboboxSingleProps> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <InField>
      <Combobox
        options={providers}
        placeholder="Pick provider"
        {...props}
        value={value}
        onValueChange={next => {
          setValue(next);
          props.onValueChange?.(next);
        }}
      />
    </InField>
  );
}

/** A multiple-select Combobox in a form field whose value the test owns. */
function MultipleField({ initial = [], ...props }: Partial<ComboboxMultipleProps> & { initial?: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <InField>
      <Combobox
        options={providers}
        placeholder="Pick providers"
        {...props}
        multiple
        value={value}
        onValueChange={next => {
          setValue(next);
          props.onValueChange?.(next);
        }}
      />
    </InField>
  );
}

const field = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Provider' });
const optionNames = () => screen.queryAllByRole('option').map(option => option.textContent);
const highlighted = () =>
  screen
    .queryAllByRole('option')
    .filter(option => option.hasAttribute('data-highlighted'))
    .map(option => option.textContent);
// While the list is open, Base UI hides everything outside it from assistive tech, the chips included.
const chipNames = () =>
  screen.queryAllByRole('button', { name: /^Remove /, hidden: true }).map(button => button.getAttribute('aria-label'));

async function openField() {
  const user = userEvent.setup();
  await user.click(field());
  await screen.findAllByRole('option');
  return user;
}

describe('Combobox', () => {
  describe('when it is a single select inside a Field', () => {
    it('is a text field named by the field label', () => {
      render(<SingleField />);

      expect(field().tagName).toBe('INPUT');
      expect(field().placeholder).toBe('Pick provider');
    });

    it('focuses the field when the label is clicked', async () => {
      render(<SingleField />);

      await userEvent.click(screen.getByText('Provider'));

      expect(document.activeElement).toBe(field());
    });

    it('opens the list when the field is clicked', async () => {
      render(<SingleField />);

      await openField();

      expect(optionNames()).toEqual(['OpenAI', 'Anthropic', 'Google']);
    });

    it('opens the list from the keyboard', async () => {
      render(<SingleField />);
      const user = userEvent.setup();

      field().focus();
      await user.keyboard('{ArrowDown}');

      expect(await screen.findByRole('option', { name: 'OpenAI' })).toBeTruthy();
    });

    it('moves the highlight with the arrow keys and selects with Enter', async () => {
      const onValueChange = vi.fn();
      render(<SingleField onValueChange={onValueChange} />);
      const user = userEvent.setup();

      field().focus();
      await user.keyboard('{ArrowDown}');
      await screen.findByRole('option', { name: 'OpenAI' });
      expect(highlighted()).toEqual(['OpenAI']);

      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toEqual(['Anthropic']);

      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith('anthropic');
    });

    it('filters the options as you type', async () => {
      render(<SingleField />);
      const user = await openField();

      await user.keyboard('goo');

      await waitFor(() => expect(optionNames()).toEqual(['Google']));
    });

    it('selects the first match with Enter after typing', async () => {
      const onValueChange = vi.fn();
      render(<SingleField onValueChange={onValueChange} />);
      const user = await openField();

      await user.keyboard('anth{Enter}');

      expect(onValueChange).toHaveBeenLastCalledWith('anthropic');
    });

    it('shows the chosen option in the field', async () => {
      render(<SingleField />);
      const user = await openField();

      await user.click(screen.getByRole('option', { name: 'Google' }));

      await waitFor(() => expect(field().value).toBe('Google'));
    });

    it('lists every option again when reopened with a value chosen', async () => {
      render(<SingleField initial="google" />);
      const user = await openField();

      expect(optionNames()).toEqual(['OpenAI', 'Anthropic', 'Google']);

      await user.keyboard('{Escape}');
      await user.click(field());

      await waitFor(() => expect(optionNames()).toEqual(['OpenAI', 'Anthropic', 'Google']));
    });

    it('marks the chosen option in the list', async () => {
      render(<SingleField initial="anthropic" />);
      await openField();

      expect(screen.getByRole('option', { name: 'Anthropic' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('option', { name: 'OpenAI' }).getAttribute('aria-selected')).toBe('false');
    });

    it('closes with Escape and keeps the value and focus', async () => {
      render(<SingleField initial="openai" />);
      const user = await openField();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
      expect(field().value).toBe('OpenAI');
      expect(document.activeElement).toBe(field());
    });

    it('says so when nothing matches', async () => {
      render(<SingleField emptyText="No providers found." />);
      const user = await openField();

      await user.keyboard('zzz');

      expect(await screen.findByText('No providers found.')).toBeTruthy();
      expect(screen.queryByRole('option')).toBeNull();
    });

    it('keeps up with a value changed by the caller', () => {
      const { rerender } = render(
        <InField>
          <Combobox options={providers} value="openai" />
        </InField>,
      );
      expect(field().value).toBe('OpenAI');

      rerender(
        <InField>
          <Combobox options={providers} value="google" />
        </InField>,
      );

      expect(field().value).toBe('Google');
    });

    it("shows the chosen option's start adornment in the field", () => {
      const withLogo: ComboboxOption[] = [{ label: 'OpenAI', value: 'openai', start: <span data-testid="logo" /> }];
      render(<SingleField options={withLogo} initial="openai" />);

      expect(field().parentElement?.contains(screen.getByTestId('logo'))).toBe(true);
    });

    it('finds an option by its keywords', async () => {
      const models: ComboboxOption[] = [
        { label: 'Claude Haiku 4.5', value: 'anthropic/claude-haiku-4-5', keywords: ['anthropic/claude-haiku-4-5'] },
        { label: 'GPT-5 Mini', value: 'openai/gpt-5-mini', keywords: ['openai/gpt-5-mini'] },
      ];
      render(<SingleField options={models} />);
      const user = await openField();

      await user.keyboard('anthropic');

      await waitFor(() => expect(optionNames()).toEqual(['Claude Haiku 4.5']));
    });

    it('finds an option by the plain-text displayLabel the field shows', async () => {
      render(
        <SingleField options={[{ label: 'Auto', value: 'auto', displayLabel: 'Auto · GPT-5 Mini' }, ...providers]} />,
      );
      const user = await openField();

      await user.keyboard('mini');

      await waitFor(() => expect(optionNames()).toEqual(['Auto']));
    });

    it('reports the typed text through onInputValueChange', async () => {
      const onInputValueChange = vi.fn();
      render(<SingleField onInputValueChange={onInputValueChange} />);
      const user = await openField();

      await user.keyboard('goo');

      expect(onInputValueChange).toHaveBeenLastCalledWith('goo');
    });

    it('opens its list in document.body when no dialog provides a container', async () => {
      const { container } = render(<SingleField />);

      await openField();

      const option = screen.getByRole('option', { name: 'OpenAI' });
      expect(document.body.contains(option)).toBe(true);
      expect(container.contains(option)).toBe(false);
    });
  });

  describe('when custom values are allowed', () => {
    it('offers the typed text as an option and picks it', async () => {
      const onValueChange = vi.fn();
      render(<SingleField allowCustomValue onValueChange={onValueChange} />);
      const user = await openField();

      await user.keyboard('new-provider/new-model');
      await user.click(await screen.findByRole('option', { name: 'Use “new-provider/new-model”' }));

      expect(onValueChange).toHaveBeenLastCalledWith('new-provider/new-model');
    });

    it('does not offer text that is already an option', async () => {
      render(<SingleField allowCustomValue />);
      const user = await openField();

      await user.keyboard('Google');

      await waitFor(() => expect(optionNames()).toEqual(['Google']));
    });

    it('does not offer the text the field shows for the chosen option', async () => {
      render(<SingleField allowCustomValue initial="google" />);

      await openField();

      expect(screen.queryByRole('option', { name: /^Use / })).toBeNull();
    });
  });

  describe('when custom values are not allowed', () => {
    it('only says nothing matches', async () => {
      render(<SingleField />);
      const user = await openField();

      await user.keyboard('new-provider/new-model');

      expect(await screen.findByText('No option found.')).toBeTruthy();
      expect(screen.queryByRole('option', { name: /new-provider/ })).toBeNull();
    });
  });

  describe('when the caller injects an option matching the search', () => {
    it('keeps it first and lets it be picked', async () => {
      const onValueChange = vi.fn();
      render(
        <SingleField
          options={[{ label: 'Create "goo"', value: '__create__' }, ...providers]}
          onValueChange={onValueChange}
        />,
      );
      const user = await openField();

      await user.keyboard('goo');
      await waitFor(() => expect(optionNames()).toEqual(['Create "goo"', 'Google']));
      await user.click(screen.getByRole('option', { name: 'Create "goo"' }));

      expect(onValueChange).toHaveBeenLastCalledWith('__create__');
    });
  });

  describe('when it is a multiple select inside a Field', () => {
    it('shows the picks as chips in the field', () => {
      render(<MultipleField initial={['openai', 'google']} />);

      expect(chipNames()).toEqual(['Remove OpenAI', 'Remove Google']);
    });

    it('shows the placeholder only while nothing is picked', () => {
      const { unmount } = render(<MultipleField />);
      expect(field().placeholder).toBe('Pick providers');
      unmount();

      render(<MultipleField initial={['openai']} />);

      expect(field().placeholder).toBe('');
    });

    it('adds a chip for each pick and keeps the list open for more', async () => {
      const onValueChange = vi.fn();
      render(<MultipleField initial={['openai']} onValueChange={onValueChange} />);
      const user = await openField();

      await user.click(screen.getByRole('option', { name: 'Anthropic' }));

      expect(onValueChange).toHaveBeenLastCalledWith(['openai', 'anthropic']);
      expect(chipNames()).toEqual(['Remove OpenAI', 'Remove Anthropic']);
      expect(screen.getByRole('option', { name: 'Google' })).toBeTruthy();
    });

    it('unpicks an option that is picked again', async () => {
      const onValueChange = vi.fn();
      render(<MultipleField initial={['openai', 'google']} onValueChange={onValueChange} />);
      const user = await openField();

      await user.click(screen.getByRole('option', { name: 'OpenAI' }));

      expect(onValueChange).toHaveBeenLastCalledWith(['google']);
    });

    it('filters as you type and clears the search after a pick', async () => {
      render(<MultipleField />);
      const user = await openField();

      await user.keyboard('anth');
      await waitFor(() => expect(optionNames()).toEqual(['Anthropic']));
      await user.keyboard('{Enter}');

      expect(chipNames()).toEqual(['Remove Anthropic']);
      await waitFor(() => expect(field().value).toBe(''));
    });

    it('removes a chip with its ×', async () => {
      render(<MultipleField initial={['openai', 'google']} />);

      await userEvent.click(screen.getByRole('button', { name: 'Remove OpenAI' }));

      expect(chipNames()).toEqual(['Remove Google']);
    });

    it('removes the last chip with Backspace in the empty field', async () => {
      render(<MultipleField initial={['openai', 'google']} />);
      const user = userEvent.setup();

      await user.click(field());
      await user.keyboard('{Backspace}');

      await waitFor(() => expect(chipNames()).toEqual(['Remove OpenAI']));
    });

    it('keeps the chips when Backspace deletes typed text', async () => {
      render(<MultipleField initial={['openai']} />);
      const user = await openField();

      await user.keyboard('go{Backspace}');

      expect(chipNames()).toEqual(['Remove OpenAI']);
      expect(field().value).toBe('g');
    });

    it('keeps up with picks changed by the caller', () => {
      const { rerender } = render(
        <InField>
          <Combobox multiple options={providers} value={['openai']} />
        </InField>,
      );
      expect(chipNames()).toEqual(['Remove OpenAI']);

      rerender(
        <InField>
          <Combobox multiple options={providers} value={['openai', 'google']} />
        </InField>,
      );

      expect(chipNames()).toEqual(['Remove OpenAI', 'Remove Google']);
    });
  });

  describe('when a multiple select offers a clear action', () => {
    it('clears every pick from the popup footer', async () => {
      const onValueChange = vi.fn();
      render(<MultipleField initial={['openai', 'anthropic']} clearLabel="Clear" onValueChange={onValueChange} />);
      const user = await openField();

      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(onValueChange).toHaveBeenLastCalledWith([]);
    });

    it('hides the action while nothing is picked', async () => {
      render(<MultipleField clearLabel="Clear" />);

      await openField();

      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    });

    it('does not submit the surrounding form', async () => {
      const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());

      function FormCombobox() {
        const formRef = useRef<HTMLFormElement>(null);
        return (
          <Form ref={formRef} onSubmit={onSubmit}>
            <MultipleField initial={['openai']} clearLabel="Clear" container={formRef} />
          </Form>
        );
      }

      render(<FormCombobox />);
      const user = await openField();
      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(chipNames()).toEqual([]);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when it is disabled', () => {
    it('does not open or take text', async () => {
      render(<SingleField disabled initial="openai" />);

      await userEvent.click(field());

      expect(field().disabled).toBe(true);
      expect(screen.queryByRole('option')).toBeNull();
    });

    it('does not let chips be removed', async () => {
      render(<MultipleField disabled initial={['openai']} />);

      await userEvent.click(screen.getByRole('button', { name: 'Remove OpenAI' }));

      expect(chipNames()).toEqual(['Remove OpenAI']);
    });
  });

  describe('when the field is invalid', () => {
    it('marks the field invalid and links the error message', () => {
      render(
        <Field invalid>
          <FieldLabel>Provider</FieldLabel>
          <Combobox options={providers} />
          <FieldError>Required</FieldError>
        </Field>,
      );
      const message = screen.getByRole('alert');

      expect(field().getAttribute('aria-invalid')).toBe('true');
      expect(field().getAttribute('aria-describedby')).toContain(message.id);
    });

    it('does the same for a multiple select', () => {
      render(
        <Field invalid>
          <FieldLabel>Provider</FieldLabel>
          <Combobox multiple options={providers} value={[]} />
          <FieldError>Required</FieldError>
        </Field>,
      );

      expect(field().getAttribute('aria-invalid')).toBe('true');
      expect(field().getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    });

    it('says nothing when the field is valid', () => {
      render(<SingleField />);

      expect(field().getAttribute('aria-invalid')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when it is outside a Field', () => {
    const trigger = () => screen.getByRole('combobox');

    it('is a button showing the chosen option', () => {
      render(<Combobox options={providers} value="anthropic" />);

      expect(trigger().tagName).toBe('BUTTON');
      expect(trigger().textContent).toContain('Anthropic');
    });

    it('shows its own invitation while nothing is chosen', () => {
      render(<Combobox options={providers} />);

      expect(trigger().textContent).toContain('Select option...');
    });

    it('names itself when no label names it', () => {
      render(<Combobox options={providers} />);

      expect(screen.getByRole('combobox', { name: 'Select option' })).toBeTruthy();
    });

    it('searches in the popup and focuses the search', async () => {
      render(<Combobox options={providers} searchPlaceholder="Search providers" />);
      const user = userEvent.setup();

      await user.click(trigger());
      const search = await screen.findByPlaceholderText('Search providers');

      await waitFor(() => expect(document.activeElement).toBe(search));
    });

    it('filters as you type in the popup search and picks with Enter', async () => {
      const onValueChange = vi.fn();
      render(<Combobox options={providers} onValueChange={onValueChange} searchPlaceholder="Search providers" />);
      const user = userEvent.setup();

      await user.click(trigger());
      const search = await screen.findByPlaceholderText('Search providers');
      await waitFor(() => expect(document.activeElement).toBe(search));
      await user.keyboard('goo');
      await waitFor(() => expect(optionNames()).toEqual(['Google']));
      await user.keyboard('{Enter}');

      expect(onValueChange).toHaveBeenLastCalledWith('google');
    });

    it('starts the popup search empty after a pick', async () => {
      const onInputValueChange = vi.fn();
      render(
        <Combobox options={providers} onInputValueChange={onInputValueChange} searchPlaceholder="Search providers" />,
      );
      const user = userEvent.setup();

      await user.click(trigger());
      const search = await screen.findByPlaceholderText('Search providers');
      await waitFor(() => expect(document.activeElement).toBe(search));
      await user.keyboard('goo');
      await user.click(await screen.findByRole('option', { name: 'Google' }));

      expect(onInputValueChange).toHaveBeenLastCalledWith('');
    });

    it('shows "N selected" for a multiple select', () => {
      render(<Combobox multiple options={providers} value={['openai', 'google']} />);

      expect(trigger().textContent).toContain('2 selected');
    });

    it('closes with Escape', async () => {
      render(<Combobox options={providers} />);
      const user = userEvent.setup();

      await user.click(trigger());
      await screen.findAllByRole('option');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
    });
  });

  describe('when a Field holds a compact trigger', () => {
    it('keeps the trigger for a ghost variant', () => {
      render(
        <InField>
          <Combobox options={providers} variant="ghost" />
        </InField>,
      );

      expect(screen.getByRole('combobox', { name: 'Provider' }).tagName).toBe('BUTTON');
    });

    it('keeps the trigger for a non-text placeholder', () => {
      render(
        <InField>
          <Combobox options={providers} placeholder={<span>Add tag</span>} />
        </InField>,
      );

      expect(screen.getByRole('combobox', { name: 'Provider' }).tagName).toBe('BUTTON');
    });
  });

  describe('when the trigger is icon-sized', () => {
    it('keeps the chosen option for assistive tech and still picks', async () => {
      const onValueChange = vi.fn();
      render(
        <Combobox
          options={providers}
          value="openai"
          onValueChange={onValueChange}
          size="icon-sm"
          aria-label="Switch provider"
        />,
      );
      const trigger = screen.getByRole('combobox', { name: 'Switch provider' });

      expect(within(trigger).getByText('OpenAI')).toBeTruthy();

      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole('option', { name: 'Anthropic' }));

      expect(onValueChange).toHaveBeenLastCalledWith('anthropic');
    });
  });

  describe('when the trigger shows only the value', () => {
    it('renders the chosen start adornment and label without a chevron', () => {
      render(
        <Combobox
          options={[{ label: 'OpenAI', value: 'openai', start: <span data-testid="logo" />, displayLabel: 'Hidden' }]}
          value="openai"
          showChevron={false}
          iconOnlyValue
        />,
      );
      const trigger = screen.getByRole('combobox');

      expect(screen.getByTestId('logo')).toBeTruthy();
      expect(trigger.textContent).toBe('Hidden');
      expect(trigger.querySelector('svg')).toBeNull();
    });
  });

  describe('when nobody listens to changes', () => {
    it('picks a single value without throwing', async () => {
      render(
        <InField>
          <Combobox options={providers} />
        </InField>,
      );
      const user = await openField();

      await expect(user.click(screen.getByRole('option', { name: 'Anthropic' }))).resolves.not.toThrow();
    });

    it('picks multiple values without throwing', async () => {
      render(
        <InField>
          <Combobox multiple options={providers} value={[]} />
        </InField>,
      );
      const user = await openField();

      await expect(user.click(screen.getByRole('option', { name: 'Anthropic' }))).resolves.not.toThrow();
    });
  });
});
