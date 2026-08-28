import type { DatasetItem } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatasetItemsList } from '../dataset-items-list';
import { renderWithProviders } from '@/test/render';

const makeItem = (id: string): DatasetItem => ({
  id,
  datasetId: 'ds-1',
  datasetVersion: 1,
  input: `input for ${id}`,
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:00:00.000Z',
});

const items = [makeItem('item-1'), makeItem('item-2'), makeItem('item-3')];

const columns = [
  { name: 'id', label: 'ID', size: '1fr' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'groundTruth', label: 'Ground truth', size: '1fr' },
  { name: 'expectedTrajectory', label: 'Trajectory', size: '1fr' },
  { name: 'createdAt', label: 'Created', size: '1fr' },
];

const renderList = (props?: Partial<Parameters<typeof DatasetItemsList>[0]>) =>
  renderWithProviders(
    <DatasetItemsList
      items={items}
      isLoading={false}
      columns={columns}
      isSelectionActive={false}
      selectedIds={new Set()}
      onToggleSelection={() => {}}
      onSelectAll={() => {}}
      onClearSelection={() => {}}
      onAddClick={() => {}}
      {...props}
    />,
  );

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-row-index]'));

describe('DatasetItemsList keyboard navigation', () => {
  describe('when the list renders', () => {
    it('applies a roving tabindex with only the first row focusable', () => {
      renderList();

      const rowElements = rows();
      expect(rowElements).toHaveLength(3);
      expect(rowElements.map(row => row.tabIndex)).toEqual([0, -1, -1]);
    });
  });

  describe('when navigating with arrow keys', () => {
    it('moves focus down and back up between rows', () => {
      renderList();

      const rowElements = rows();
      fireEvent.focus(rowElements[0]);
      fireEvent.keyDown(rowElements[0], { key: 'ArrowDown' });

      expect(document.activeElement).toBe(rowElements[1]);
      expect(rowElements[1].tabIndex).toBe(0);
      expect(rowElements[0].tabIndex).toBe(-1);

      fireEvent.keyDown(rowElements[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(rowElements[0]);
    });

    it('does not move past the last row', () => {
      renderList();

      const rowElements = rows();
      fireEvent.focus(rowElements[2]);
      fireEvent.keyDown(rowElements[2], { key: 'ArrowDown' });

      expect(document.activeElement).toBe(rowElements[2]);
    });
  });

  describe('when using Home and End', () => {
    it('jumps to the first and last rows', () => {
      renderList();

      const rowElements = rows();
      fireEvent.focus(rowElements[0]);
      fireEvent.keyDown(rowElements[0], { key: 'End' });
      expect(document.activeElement).toBe(rowElements[2]);

      fireEvent.keyDown(rowElements[2], { key: 'Home' });
      expect(document.activeElement).toBe(rowElements[0]);
    });
  });

  describe('when activating a focused row', () => {
    it('clicking the row still triggers onItemClick', () => {
      const onItemClick = vi.fn();
      renderList({ onItemClick });

      const rowElements = rows();
      fireEvent.focus(rowElements[0]);
      fireEvent.keyDown(rowElements[0], { key: 'ArrowDown' });
      fireEvent.click(rowElements[1]);

      expect(onItemClick).toHaveBeenCalledWith('item-2');
    });
  });

  describe('when selection mode is active', () => {
    it('keeps keyboard navigation on the inner row buttons', () => {
      renderList({ isSelectionActive: true });

      const rowElements = rows();
      expect(rowElements).toHaveLength(3);
      expect(screen.getByLabelText('Select item item-1')).not.toBeNull();

      fireEvent.focus(rowElements[0]);
      fireEvent.keyDown(rowElements[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(rowElements[1]);
    });
  });
});
