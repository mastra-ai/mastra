import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ProcessorInfo } from '../../../hooks/use-processors';
import { ProcessorsList } from '../processors-list';
import type { ProcessorsListProps } from '../processors-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const processors: Record<string, ProcessorInfo> = {
  'proc-c': { id: 'proc-c', name: 'Charlie', phases: ['input'], agentIds: ['a1'], isWorkflow: false },
  'proc-a': { id: 'proc-a', name: 'Alpha', phases: ['outputStream'], agentIds: [], isWorkflow: false },
  'proc-b': { id: 'proc-b', name: 'Bravo', phases: ['input'], agentIds: ['a1', 'a2'], isWorkflow: false },
};

const renderList = (props?: Partial<ProcessorsListProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <ProcessorsList processors={processors} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowIds = () => interactiveRows().map(row => row.getAttribute('href')?.replace('/processors/', ''));

describe('ProcessorsList', () => {
  describe('when sorted from the Name column', () => {
    it('reports the requested direction to the parent', () => {
      const onSortChange = vi.fn();
      renderList({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Name, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'name');
    });

    it('orders processors Z to A when descending', () => {
      renderList({ sort: { key: 'name', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['proc-c', 'proc-b', 'proc-a']);
    });
  });

  describe('when sorted from the Used by column', () => {
    it('puts the most-used processor first when descending', () => {
      renderList({ sort: { key: 'agents', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['proc-b', 'proc-c', 'proc-a']);
    });
  });
});
