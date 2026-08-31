// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Combobox } from './combobox';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

const options = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google', value: 'google' },
];

function renderCombobox(props?: { onValueChange?: (value: string) => void; value?: string }) {
  return render(
    <Combobox
      options={options}
      value={props?.value}
      onValueChange={props?.onValueChange}
      placeholder="Pick provider"
      searchPlaceholder="Search providers"
    />,
  );
}

describe('Combobox', () => {
  it('opens the popup outside a portal container provider', async () => {
    renderCombobox();

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'OpenAI' })).toBeTruthy();
    });
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Google' })).toBeTruthy();
  });

  it('portals the popup into document.body when there is no portal container provider', async () => {
    const { container } = renderCombobox();

    fireEvent.click(screen.getByRole('combobox'));

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

    fireEvent.click(screen.getByRole('combobox'));

    const anthropic = await screen.findByRole('option', { name: 'Anthropic' });
    fireEvent.pointerDown(anthropic, { pointerType: 'mouse' });
    fireEvent.click(anthropic, { detail: 1 });

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

  it('selects the first filtered item when pressing Enter after searching', async () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });

    fireEvent.click(screen.getByRole('combobox'));

    const search = await screen.findByPlaceholderText('Search providers');
    fireEvent.input(search, { target: { value: 'goo' }, inputType: 'insertText' });

    const google = await screen.findByRole('option', { name: 'Google' });
    await waitFor(() => {
      expect(google.hasAttribute('data-highlighted')).toBe(true);
    });

    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('google');
    });
  });

  it('renders a pill-shaped trigger from the shared buttonVariants recipe', () => {
    render(<Combobox options={options} placeholder="Pick provider" />);

    const trigger = screen.getByRole('combobox');
    // Composes the Button recipe: pill radius + full-width field layout.
    expect(trigger.className).toContain('rounded-full');
    expect(trigger.className).toContain('w-full');
    expect(trigger.className).toContain('justify-between');
  });

  it('defaults to the filled default variant; outline is transparent-bordered; ghost drops the border', () => {
    const { rerender } = render(<Combobox options={options} placeholder="Pick provider" />);
    // Default === the Button `default`: a filled surface.
    const defaultClass = screen.getByRole('combobox').className;
    expect(defaultClass).toContain('bg-surface3');
    expect(defaultClass).not.toContain('bg-transparent');

    // Outline === a transparent bordered field.
    rerender(<Combobox options={options} placeholder="Pick provider" variant="outline" />);
    const outlineClass = screen.getByRole('combobox').className;
    expect(outlineClass).toContain('bg-transparent');
    expect(outlineClass).toContain('border-border1');

    // Ghost === borderless: same shape, transparent border instead.
    rerender(<Combobox options={options} placeholder="Pick provider" variant="ghost" />);
    const ghostClass = screen.getByRole('combobox').className;
    expect(ghostClass).toContain('border-transparent');
    expect(ghostClass).not.toContain('border-border1');

    // Legacy `link` is still accepted for source compatibility, but renders as
    // the closest field-safe look.
    rerender(<Combobox options={options} placeholder="Pick provider" variant="link" />);
    expect(screen.getByRole('combobox').className).toContain('border-transparent');
  });

  it('applies the error border when an error is provided', () => {
    render(<Combobox options={options} placeholder="Pick provider" error="Required" />);
    expect(screen.getByRole('combobox').className).toContain('border-error');
  });

  it('says what went wrong under the field, and nothing when nothing did', () => {
    const withError = render(<Combobox options={options} error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy();
    const withErrorCount = (withError.container.firstElementChild as HTMLElement).childElementCount;

    cleanup();

    const withoutError = render(<Combobox options={options} />);

    expect((withoutError.container.firstElementChild as HTMLElement).childElementCount).toBe(withErrorCount - 1);
  });

  it('takes the medium size unless the caller asks otherwise', () => {
    const { rerender } = render(<Combobox options={options} />);
    expect(screen.getByRole('combobox').className).toContain('h-form-md');

    rerender(<Combobox options={options} size="sm" />);

    expect(screen.getByRole('combobox').className).toContain('h-form-sm');
  });

  it('invites a choice in its own words when the caller gives none', () => {
    const { rerender } = render(<Combobox options={options} />);
    expect(screen.getByRole('combobox').textContent).toContain('Select option...');

    rerender(<Combobox multiple options={options} value={[]} />);

    expect(screen.getByRole('combobox').textContent).toContain('Select options...');
  });

  it('offers its own words for searching and for a search that finds nothing', async () => {
    render(<Combobox options={options} />);

    fireEvent.click(screen.getByRole('combobox'));
    const search = await screen.findByPlaceholderText('Search...');
    fireEvent.change(search, { target: { value: 'nothing matches this' } });

    expect(await screen.findByText('No option found.')).toBeTruthy();
  });

  it('shows the option that is chosen, not the invitation', () => {
    render(<Combobox options={options} value="anthropic" placeholder="Pick provider" />);

    expect(screen.getByRole('combobox').textContent).toContain('Anthropic');
    expect(screen.getByRole('combobox').textContent).not.toContain('Pick provider');
  });

  it('greys out the invitation only while nothing is chosen', () => {
    const { rerender } = render(<Combobox multiple options={options} value={[]} placeholder="Pick providers" />);
    const label = () => screen.getByRole('combobox').firstElementChild as HTMLElement;
    expect(label().classList.contains('text-neutral3')).toBe(true);

    rerender(<Combobox multiple options={options} value={['openai']} placeholder="Pick providers" />);

    expect(label().textContent).toBe('1 selected');
    expect(label().classList.contains('text-neutral3')).toBe(false);
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

    fireEvent.click(screen.getByRole('combobox'));

    const withDescription = await screen.findByRole('option', { name: /OpenAI/ });
    expect(withDescription.textContent).toContain('GPT models');
    expect(screen.getByRole('option', { name: 'Anthropic' }).querySelector('span > span:nth-child(2)')).toBeNull();
  });

  it('says what went wrong under a multi-select field too', () => {
    const withError = render(<Combobox multiple options={options} value={[]} error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy();
    const withErrorCount = (withError.container.firstElementChild as HTMLElement).childElementCount;

    cleanup();

    const withoutError = render(<Combobox multiple options={options} value={[]} />);

    expect((withoutError.container.firstElementChild as HTMLElement).childElementCount).toBe(withErrorCount - 1);
  });

  it('picks a single value with nobody listening', async () => {
    render(<Combobox options={options} />);

    fireEvent.click(screen.getByRole('combobox'));
    const anthropic = await screen.findByRole('option', { name: 'Anthropic' });

    expect(() => {
      fireEvent.pointerDown(anthropic, { pointerType: 'mouse' });
      fireEvent.click(anthropic, { detail: 1 });
    }).not.toThrow();
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
