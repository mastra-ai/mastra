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
});
