import { describe, expect, it } from 'vitest';

import type { ProcessorInfo } from '../../../hooks/use-processors';
import { ProcessorsList } from '../processors-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const processors: Record<string, ProcessorInfo> = {
  'proc-a': { id: 'proc-a', name: 'Processor A', phases: ['input'], agentIds: [], isWorkflow: false },
  'proc-b': { id: 'proc-b', name: 'Processor B', phases: ['outputStream'], agentIds: [], isWorkflow: false },
  'proc-c': { id: 'proc-c', name: 'Processor C', phases: ['input', 'outputResult'], agentIds: [], isWorkflow: true },
};

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ProcessorsList processors={processors} isLoading={false} />
    </TestLinkProvider>,
  );

describe('ProcessorsList keyboard navigation', () => {
  it('applies a roving tabindex to processor rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });
});
