import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { ToolsList } from '../tools-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const tools = {
  'weather-tool': { id: 'weather-tool', description: 'Gets the weather' },
  'search-tool': { id: 'search-tool', description: 'Searches the web' },
  'math-tool': { id: 'math-tool', description: 'Does math' },
} as unknown as Record<string, GetToolResponse>;

const agents = {} as Record<string, GetAgentResponse>;

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ToolsList tools={tools} agents={agents} isLoading={false} />
    </TestLinkProvider>,
  );

describe('ToolsList keyboard navigation', () => {
  it('applies a roving tabindex to tool rows', () => {
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

  it('keeps row links navigable (href preserved on the focus target)', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows.map(row => row.getAttribute('href'))).toEqual([
      '/tools/weather-tool',
      '/tools/search-tool',
      '/tools/math-tool',
    ]);
  });
});
