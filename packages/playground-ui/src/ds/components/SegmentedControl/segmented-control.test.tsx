// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sun } from 'lucide-react';
import { createRef } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Field, FieldLabel } from '../Field';
import { SegmentedControl, SegmentedControlItem } from './segmented-control';

// Base UI synthesizes a PointerEvent on click, which jsdom does not implement.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: window.MouseEvent });
  }
});

afterEach(() => {
  cleanup();
});

function Permission({
  onValueChange = () => {},
  disabled,
}: {
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl aria-label="Permission" value="ask" onValueChange={onValueChange} disabled={disabled}>
      <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
      <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
      <SegmentedControlItem value="deny">Deny</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe('SegmentedControl', () => {
  describe('when rendered with text items', () => {
    it('exposes a named radio group with one radio per item', () => {
      render(<Permission />);

      expect(screen.getByRole('radiogroup', { name: 'Permission' })).toBeDefined();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('marks only the selected item as checked', () => {
      render(<Permission />);

      expect(screen.getByRole('radio', { name: 'Ask' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('radio', { name: 'Allow' }).getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('when an item is clicked', () => {
    it('reports that item value', () => {
      const onValueChange = vi.fn();
      render(<Permission onValueChange={onValueChange} />);

      fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

      expect(onValueChange).toHaveBeenCalledWith('deny');
    });
  });

  describe('when the whole control is disabled', () => {
    it('ignores clicks', () => {
      const onValueChange = vi.fn();
      render(<Permission onValueChange={onValueChange} disabled />);

      fireEvent.click(screen.getByRole('radio', { name: 'Deny' }));

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('when a single item is disabled', () => {
    function Scope({ onValueChange }: { onValueChange: (value: string) => void }) {
      return (
        <SegmentedControl aria-label="Scope" value="user" onValueChange={onValueChange}>
          <SegmentedControlItem value="user">Just me</SegmentedControlItem>
          <SegmentedControlItem value="org" disabled title="Admins only">
            Everyone
          </SegmentedControlItem>
        </SegmentedControl>
      );
    }

    it('ignores clicks on that item', () => {
      const onValueChange = vi.fn();
      render(<Scope onValueChange={onValueChange} />);

      fireEvent.click(screen.getByRole('radio', { name: 'Everyone' }));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keeps its tooltip', () => {
      render(<Scope onValueChange={() => {}} />);

      expect(screen.getByRole('radio', { name: 'Everyone' }).getAttribute('title')).toBe('Admins only');
    });
  });

  describe('when the control is icon-only', () => {
    it('names each item by its aria-label', () => {
      render(
        <SegmentedControl aria-label="Theme" iconOnly value="light" onValueChange={() => {}}>
          <SegmentedControlItem value="light" aria-label="Light">
            <Sun />
          </SegmentedControlItem>
        </SegmentedControl>,
      );

      expect(screen.getByRole('radio', { name: 'Light' }).textContent).toBe('');
    });
  });

  describe('when placed in a labelled Field, such as a SettingsRow', () => {
    it('keeps the group and item names instead of taking the row label', () => {
      render(
        <Field>
          <FieldLabel>Notifications</FieldLabel>
          <SegmentedControl aria-label="Delivery" value="sound" onValueChange={() => {}}>
            <SegmentedControlItem value="sound">Sound</SegmentedControlItem>
            <SegmentedControlItem value="badge" aria-label="Badge only">
              <Sun />
            </SegmentedControlItem>
          </SegmentedControl>
        </Field>,
      );

      expect(screen.getByRole('radiogroup', { name: 'Delivery' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Sound' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Badge only' })).toBeDefined();
    });
  });

  describe('when the caller passes a ref to an item', () => {
    it('attaches it to the item element', () => {
      const ref = createRef<HTMLElement>();
      render(
        <SegmentedControl aria-label="Permission" value="ask" onValueChange={() => {}}>
          <SegmentedControlItem ref={ref} value="ask">
            Ask
          </SegmentedControlItem>
        </SegmentedControl>,
      );

      expect(ref.current).toBe(screen.getByRole('radio', { name: 'Ask' }));
    });
  });

  describe('when an item is rendered outside a SegmentedControl', () => {
    it('throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<SegmentedControlItem value="x">X</SegmentedControlItem>)).toThrow(
        'SegmentedControlItem must be used inside a SegmentedControl',
      );
    });
  });
});
