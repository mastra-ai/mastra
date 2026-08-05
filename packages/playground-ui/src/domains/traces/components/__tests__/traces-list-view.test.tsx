// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { TracesListView } from '../traces-list-view';

afterEach(cleanup);

describe('TracesListView columns', () => {
  describe('when no column preferences are provided', () => {
    it('keeps the existing default headers and grid', () => {
      const { container } = render(<TracesListView traces={[]} onTraceClick={vi.fn()} />);

      expect(screen.getByText('Input')).toBeTruthy();
      expect(screen.getByText('Entity')).toBeTruthy();
      expect(screen.queryByText('Duration')).toBeNull();

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      assert(grid);
      expect(grid.style.gridTemplateColumns).toBe('6rem 9rem 14rem minmax(8rem,1fr) 14rem 6rem');
    });
  });

  describe('when optional and metadata columns are selected', () => {
    it('renders every selected header in the matching grid', () => {
      const { container } = render(
        <TracesListView
          traces={[]}
          columnPreferences={{
            visibleColumns: ['duration', 'inputTokens', 'outputTokens', 'estimatedCost'],
            metadataKeys: ['tenantId'],
          }}
          onTraceClick={vi.fn()}
        />,
      );

      expect(screen.queryByText('Input')).toBeNull();
      expect(screen.queryByText('Entity')).toBeNull();
      expect(screen.getByText('Duration')).toBeTruthy();
      expect(screen.getByText('Input tokens')).toBeTruthy();
      expect(screen.getByText('Output tokens')).toBeTruthy();
      expect(screen.getByText('Est. cost')).toBeTruthy();
      expect(screen.getByText('tenantId')).toBeTruthy();

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      assert(grid);
      expect(grid.style.gridTemplateColumns).toBe(
        '6rem 9rem minmax(14rem,1fr) 6rem 7rem 8rem 8rem 8rem minmax(8rem,14rem)',
      );
    });
  });
});
