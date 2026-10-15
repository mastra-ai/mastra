// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field, FieldError, FieldLabel } from '../Field';
import { Form } from '../Form';
import { Combobox as BareCombobox } from './combobox';
import type { ComboboxProps } from './combobox';

/** Most tests use the Combobox the way forms do: inside a `Field`, where a single select searches in the field. */
function Combobox(props: ComboboxProps) {
  return (
    <Field>
      <FieldLabel>Provider</FieldLabel>
      <BareCombobox {...props} />
    </Field>
  );
}

afterEach(() => {
  cleanup();
});

const options = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google', value: 'google' },
];

/** A single-select `default` Combobox is a field: you click it to open the list and type in it to search. */
async function openField(user = userEvent.setup()) {
  const field = screen.getByRole('combobox');
  await user.click(field);
  await screen.findAllByRole('option');
  return { user, field };
}

function renderCombobox(props?: {
  onValueChange?: (value: string) => void;
  value?: string;
  allowCustomValue?: boolean;
}) {
  return render(
    <Combobox
      options={options}
      value={props?.value}
      onValueChange={props?.onValueChange}
      placeholder="Pick provider"
      searchPlaceholder="Search providers"
      allowCustomValue={props?.allowCustomValue}
    />,
  );
}

describe('Combobox', () => {
  it('opens the popup outside a portal container provider', async () => {
    renderCombobox();

    await openField();

    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Google' })).toBeTruthy();
  });

  it('portals the popup into document.body when there is no portal container provider', async () => {
    const { container } = renderCombobox();

    await openField();

    // The regression: outside a SideDialog the portal container resolved to
    // `null`, which Base UI's FloatingPortal reads as "render nothing", so the
    // popup never mounted. It must land in document.body, outside the trigger's
    // own subtree.
    const option = await screen.findByRole('option', { name: 'OpenAI' });
    expect(document.body.contains(option)).toBe(true);
    expect(container.contains(option)).toBe(false);
  });

  it('selects an item and fires onValueChange with the selected value', async () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });

    const { user } = await openField();
    await user.click(screen.getByRole('option', { name: 'Anthropic' }));

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('anthropic');
    });
  });

  it('supports multiple selections and fires onValueChange with selected values', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        multiple
        options={options}
        value={['openai']}
        onValueChange={onValueChange}
        placeholder="Pick providers"
        searchPlaceholder="Search providers"
      />,
    );

    expect(screen.getByRole('combobox').textContent).toContain('1 selected');

    fireEvent.click(screen.getByRole('combobox'));

    const anthropic = await screen.findByRole('option', { name: 'Anthropic' });
    fireEvent.pointerDown(anthropic, { pointerType: 'mouse' });
    fireEvent.click(anthropic, { detail: 1 });

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith(['openai', 'anthropic']);
    });
  });

  it('clears a multi-selection from the popup footer', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        multiple
        options={options}
        value={['openai', 'anthropic']}
        onValueChange={onValueChange}
        clearLabel="Clear"
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it('does not submit a form when clearing a multi-selection from its portal', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onValueChange = vi.fn();

    function FormCombobox() {
      const formRef = useRef<HTMLFormElement>(null);

      return (
        <Form ref={formRef} onSubmit={onSubmit}>
          <Combobox
            multiple
            container={formRef}
            options={options}
            value={['openai']}
            onValueChange={onValueChange}
            clearLabel="Clear"
          />
        </Form>
      );
    }

    render(<FormCombobox />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(onValueChange).toHaveBeenCalledWith([]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the clear action only when a selected multi-combobox provides its label', async () => {
    const { rerender } = render(<Combobox multiple options={options} value={[]} clearLabel="Clear" />);

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    rerender(<Combobox multiple options={options} value={['openai']} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('selects the first filtered item when pressing Enter after searching in the field', async () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });

    const { user } = await openField();
    // No separate search row: the field itself is the search.
    expect(screen.queryByPlaceholderText('Search providers')).toBeNull();
    await user.keyboard('goo');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'OpenAI' })).toBeNull();
    });
    const google = screen.getByRole('option', { name: 'Google' });
    await waitFor(() => {
      expect(google.hasAttribute('data-highlighted')).toBe(true);
    });

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('google');
    });
  });

  it('finds an option by its keywords as well as its label', async () => {
    render(
      <Combobox
        options={[
          { label: 'Claude Haiku 4.5', value: 'anthropic/claude-haiku-4-5', keywords: ['anthropic/claude-haiku-4-5'] },
          { label: 'GPT-5 Mini', value: 'openai/gpt-5-mini', keywords: ['openai/gpt-5-mini'] },
        ]}
      />,
    );

    const { user, field } = await openField();

    await user.keyboard('anthropic');
    await waitFor(() => {
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Claude Haiku 4.5']);
    });

    await user.clear(field);
    await user.keyboard('mini');
    await waitFor(() => {
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['GPT-5 Mini']);
    });
  });

  it('selects a custom value when custom values are allowed', async () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange, allowCustomValue: true });

    const { user } = await openField();
    await user.keyboard('new-provider/new-model');

    await user.click(await screen.findByRole('option', { name: 'Use “new-provider/new-model”' }));

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('new-provider/new-model');
    });
  });

  it('reports the search text through onInputValueChange and resets it after a compact selection', async () => {
    const onInputValueChange = vi.fn();
    render(
      <Combobox
        options={options}
        variant="ghost"
        onInputValueChange={onInputValueChange}
        searchPlaceholder="Search providers"
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));

    const search = await screen.findByPlaceholderText('Search providers');
    fireEvent.input(search, { target: { value: 'goo' }, inputType: 'insertText' });

    await waitFor(() => {
      expect(onInputValueChange).toHaveBeenCalledWith('goo');
    });

    const google = await screen.findByRole('option', { name: 'Google' });
    fireEvent.pointerDown(google, { pointerType: 'mouse' });
    fireEvent.click(google, { detail: 1 });

    await waitFor(() => {
      expect(onInputValueChange).toHaveBeenLastCalledWith('');
    });
  });

  it('reports the text typed in a field through onInputValueChange', async () => {
    const onInputValueChange = vi.fn();
    render(<Combobox options={options} onInputValueChange={onInputValueChange} />);

    const { user } = await openField();
    await user.keyboard('goo');

    await waitFor(() => {
      expect(onInputValueChange).toHaveBeenLastCalledWith('goo');
    });
  });

  it('shows the chosen option in the field after a pick, not the search text', async () => {
    function Controlled() {
      const [value, setValue] = useState<string>();
      return <Combobox options={options} value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);

    const { user, field } = await openField();
    await user.keyboard('goo');
    await user.click(await screen.findByRole('option', { name: 'Google' }));

    await waitFor(() => expect((field as HTMLInputElement).value).toBe('Google'));
  });

  it('keeps a consumer-injected option whose label contains the search text as the first option', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox options={[{ label: 'Create "goo"', value: '__create__' }, ...options]} onValueChange={onValueChange} />,
    );

    const { user } = await openField();
    await user.keyboard('goo');

    await waitFor(() => {
      expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Create "goo"', 'Google']);
    });

    await user.click(screen.getByRole('option', { name: 'Create "goo"' }));

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('__create__');
    });
  });

  it('does not offer a custom value unless custom values are allowed', async () => {
    renderCombobox();

    const { user } = await openField();
    await user.keyboard('new-provider/new-model');

    expect(await screen.findByText('No option found.')).toBeTruthy();
    expect(screen.queryByRole('option', { name: /new-provider\/new-model/ })).toBeNull();
  });

  it('renders a pill-shaped field and trigger from the shared buttonVariants recipe', () => {
    render(<Combobox options={options} placeholder="Pick provider" />);

    // Composes the Button recipe: pill radius; width belongs to the call site.
    const field = screen.getByRole('combobox').closest('[data-slot=combobox-input]');
    expect(field?.className).toContain('rounded-full');

    cleanup();
    render(<Combobox options={options} placeholder="Pick provider" variant="ghost" />);

    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain('rounded-full');
    expect(trigger.className).toContain('justify-between');
  });

  it('renders options on the shared menu item recipe (md, rounded-lg)', async () => {
    render(<Combobox options={options} placeholder="Pick provider" />);

    await openField();

    const option = await screen.findByRole('option', { name: 'OpenAI' });
    expect(option.className).toContain('min-h-control-md');
    expect(option.className).toContain('text-label');
    expect(option.className).toContain('rounded-lg');
    expect(option.className).not.toContain('rounded-full');
    expect(option.className).not.toContain('rounded-md');
  });

  it('says what went wrong under the field, and nothing when nothing did', () => {
    render(
      <Field invalid>
        <FieldLabel>Provider</FieldLabel>
        <BareCombobox options={options} />
        <FieldError>Required</FieldError>
      </Field>,
    );
    const field = screen.getByRole('combobox', { name: 'Provider' });
    const message = screen.getByRole('alert');

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
    expect(message.textContent).toContain('Required');

    cleanup();

    render(
      <Field>
        <FieldLabel>Provider</FieldLabel>
        <BareCombobox options={options} />
      </Field>,
    );

    expect(screen.getByRole('combobox', { name: 'Provider' }).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes the medium size unless the caller asks otherwise', () => {
    const fieldClass = () => screen.getByRole('combobox').closest('[data-slot=combobox-input]')?.className;
    const { rerender } = render(<Combobox options={options} />);
    expect(fieldClass()).toContain('h-control-md');

    rerender(<Combobox options={options} size="sm" />);

    expect(fieldClass()).toContain('h-control-sm');
  });

  it('renders a chevron-only trigger at icon sizes while keeping the value for assistive tech', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        options={options}
        value="openai"
        onValueChange={onValueChange}
        size="icon-sm"
        aria-label="Switch provider"
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Switch provider' });
    expect(trigger.className).toContain('w-control-sm');
    expect(trigger.className).not.toContain('w-full');
    expect(trigger.dataset.shape).toBe('icon');
    expect(screen.getByText('OpenAI').className).toContain('sr-only');

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Anthropic' }));

    expect(onValueChange).toHaveBeenCalledWith('anthropic');
  });

  it('invites a choice in its own words when the caller gives none', () => {
    render(<Combobox options={options} />);
    expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('Select option...');

    cleanup();
    render(<Combobox multiple options={options} value={[]} />);

    expect(screen.getByRole('combobox').textContent).toContain('Select options...');
  });

  it('offers its own words for searching and for a search that finds nothing', async () => {
    render(<Combobox options={options} variant="ghost" />);

    fireEvent.click(screen.getByRole('combobox'));
    const search = await screen.findByPlaceholderText('Search...');
    fireEvent.change(search, { target: { value: 'nothing matches this' } });

    expect(await screen.findByText('No option found.')).toBeTruthy();

    cleanup();
    render(<Combobox options={options} />);
    const { user } = await openField();
    await user.keyboard('nothing matches this');

    expect(await screen.findByText('No option found.')).toBeTruthy();
  });

  it('shows the option that is chosen, not the invitation', () => {
    render(<Combobox options={options} value="anthropic" placeholder="Pick provider" />);

    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Anthropic');

    cleanup();
    render(<Combobox options={options} value="anthropic" placeholder="Pick provider" variant="ghost" />);

    expect(screen.getByRole('combobox').textContent).toContain('Anthropic');
    expect(screen.getByRole('combobox').textContent).not.toContain('Pick provider');
  });

  it("shows the selected option's start adornment in the field", () => {
    render(
      <Combobox
        options={[{ label: 'OpenAI', value: 'openai', start: <span data-testid="logo" /> }, ...options.slice(1)]}
        value="openai"
      />,
    );

    const field = screen.getByRole('combobox').closest('[data-slot=combobox-input]');
    expect(field?.contains(screen.getByTestId('logo'))).toBe(true);
  });

  it('keeps up with a selection that changes from outside', () => {
    const { rerender } = render(<Combobox multiple options={options} value={['openai']} />);
    expect(screen.getByRole('combobox').textContent).toContain('1 selected');

    rerender(<Combobox multiple options={options} value={['openai', 'google']} />);

    expect(screen.getByRole('combobox').textContent).toContain('2 selected');
  });

  it('describes an option that carries a description', async () => {
    const described = [
      { label: 'OpenAI', value: 'openai', description: 'GPT models' },
      { label: 'Anthropic', value: 'anthropic' },
    ];
    render(<Combobox options={described} />);

    await openField();

    const withDescription = await screen.findByRole('option', { name: /OpenAI/ });
    expect(withDescription.textContent).toContain('GPT models');
    expect(screen.getByRole('option', { name: 'Anthropic' }).querySelector('span > span:nth-child(2)')).toBeNull();
  });

  it('says what went wrong under a multi-select field too', () => {
    render(
      <Field invalid>
        <FieldLabel>Providers</FieldLabel>
        <BareCombobox multiple options={options} value={[]} />
        <FieldError>Required</FieldError>
      </Field>,
    );
    const field = screen.getByRole('combobox', { name: 'Providers' });

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });

  it('picks a single value with nobody listening', async () => {
    render(<Combobox options={options} />);

    const { user } = await openField();

    await expect(user.click(screen.getByRole('option', { name: 'Anthropic' }))).resolves.not.toThrow();
  });

  it('picks a value with nobody listening', async () => {
    render(<Combobox multiple options={options} value={[]} />);

    fireEvent.click(screen.getByRole('combobox'));
    const anthropic = await screen.findByRole('option', { name: 'Anthropic' });

    expect(() => {
      fireEvent.pointerDown(anthropic, { pointerType: 'mouse' });
      fireEvent.click(anthropic, { detail: 1 });
    }).not.toThrow();
  });
});

describe('Combobox outside a Field', () => {
  it('keeps a compact trigger with the search in the popup', async () => {
    const onValueChange = vi.fn();
    render(
      <BareCombobox
        options={options}
        onValueChange={onValueChange}
        aria-label="Provider"
        searchPlaceholder="Search providers"
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Provider' });
    expect(trigger.tagName).toBe('BUTTON');

    fireEvent.click(trigger);
    const search = await screen.findByPlaceholderText('Search providers');
    fireEvent.input(search, { target: { value: 'goo' }, inputType: 'insertText' });
    fireEvent.click(await screen.findByRole('option', { name: 'Google' }));

    expect(onValueChange).toHaveBeenCalledWith('google');
  });
});

describe('Combobox icon-only value', () => {
  it('renders the selected start adornment and label without a chevron', () => {
    render(
      <Combobox
        options={[{ label: 'OpenAI', value: 'openai', start: <span data-testid="logo" />, displayLabel: 'Hidden' }]}
        value="openai"
        showChevron={false}
        iconOnlyValue
      />,
    );

    // A compact trigger: no chevron, so the search lives in the popup.
    const trigger = screen.getByRole('combobox');
    expect(trigger.tagName).toBe('BUTTON');
    expect(screen.getByTestId('logo')).toBeTruthy();
    expect(trigger.textContent).toBe('Hidden');
    expect(trigger.querySelector('svg')).toBeNull();
  });
});
