// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sun } from 'lucide-react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SegmentedControl, SegmentedControlItem } from './segmented-control';

// Base UI synthesizes a PointerEvent on click, which jsdom does not implement.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

function Permission(props: { value?: string; onValueChange?: (value: string) => void; disabled?: boolean }) {
  return (
    <SegmentedControl
      aria-label="Permission"
      value={props.value ?? 'ask'}
      onValueChange={props.onValueChange ?? (() => {})}
      disabled={props.disabled}
    >
      <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
      <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
      <SegmentedControlItem value="deny">Deny</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe('SegmentedControl', () => {
  it('renders a named radio group with one radio per item', () => {
    render(<Permission />);

    expect(screen.getByRole('radiogroup', { name: 'Permission' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Ask' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Allow' }).getAttribute('aria-checked')).toBe('false');
  });

  it('calls onValueChange with the clicked item', () => {
    const onValueChange = vi.fn();
    render(<Permission onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

    expect(onValueChange).toHaveBeenCalledWith('deny');
  });

  it('does not change when disabled', () => {
    const onValueChange = vi.fn();
    render(<Permission onValueChange={onValueChange} disabled />);

    fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not select a disabled item', () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl aria-label="Scope" value="user" onValueChange={onValueChange}>
        <SegmentedControlItem value="user">Just me</SegmentedControlItem>
        <SegmentedControlItem value="org" disabled title="Admins only">
          Everyone
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Everyone' }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Everyone' }).getAttribute('title')).toBe('Admins only');
  });

  it('names icon-only items by their aria-label', () => {
    render(
      <SegmentedControl aria-label="Theme" iconOnly value="light" onValueChange={() => {}}>
        <SegmentedControlItem value="light" aria-label="Light">
          <Sun />
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    expect(screen.getByRole('radio', { name: 'Light' }).textContent).toBe('');
  });

  it('throws when an item is rendered outside a SegmentedControl', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SegmentedControlItem value="x">X</SegmentedControlItem>)).toThrow(
      'SegmentedControlItem must be used inside a SegmentedControl',
    );
  });
});
