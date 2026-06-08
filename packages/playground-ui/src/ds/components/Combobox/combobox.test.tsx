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
  });

  it('applies the error border when an error is provided', () => {
    render(<Combobox options={options} placeholder="Pick provider" error="Required" />);
    expect(screen.getByRole('combobox').className).toContain('border-error');
  });
});
