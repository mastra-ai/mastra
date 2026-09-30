// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sun } from 'lucide-react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './segmented-control';

// Base UI synthesizes a PointerEvent on click, which jsdom does not implement.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'ask', label: 'Ask' },
  { value: 'deny', label: 'Deny' },
] as const;

describe('SegmentedControl', () => {
  it('renders a named radio group with one radio per option', () => {
    render(<SegmentedControl aria-label="Permission" options={OPTIONS} value="ask" onValueChange={() => {}} />);

    expect(screen.getByRole('radiogroup', { name: 'Permission' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Ask' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Allow' }).getAttribute('aria-checked')).toBe('false');
  });

  it('calls onValueChange with the clicked option', () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl aria-label="Permission" options={OPTIONS} value="ask" onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

    expect(onValueChange).toHaveBeenCalledWith('deny');
  });

  it('does not change when disabled', () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl aria-label="Permission" options={OPTIONS} value="ask" onValueChange={onValueChange} disabled />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('uses the label as the accessible name when icon-only', () => {
    render(
      <SegmentedControl
        aria-label="Theme"
        iconOnly
        options={[{ value: 'light', label: 'Light', icon: <Sun /> }]}
        value="light"
        onValueChange={() => {}}
      />,
    );

    const radio = screen.getByRole('radio', { name: 'Light' });
    expect(radio.textContent).toBe('');
  });
});
