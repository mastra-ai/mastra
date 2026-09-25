// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemListDateCell } from './item-list-date-cell';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ItemListDateCell', () => {
  describe('when displaying today with the date preset', () => {
    it('displays only the date', () => {
      const date = new Date(2026, 8, 24, 14, 32);
      vi.useFakeTimers();
      vi.setSystemTime(date);
      const { container } = render(<ItemListDateCell date={date} preset="date" />);
      expect(container.textContent).toBe(
        new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date),
      );
    });
  });
  describe('when displaying a historical timestamp with the date-time preset', () => {
    it('preserves the time', () => {
      const date = new Date(2025, 2, 5, 9, 7);
      const { container } = render(<ItemListDateCell date={date} preset="date-time" />);
      expect(container.textContent).toBe(
        new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(date),
      );
    });
  });
});
