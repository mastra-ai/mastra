import type { GetAgentResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { AgentsList } from '../agents-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const agent = (id: string, name: string): GetAgentResponse =>
  ({
    id,
    name,
    instructions: `${name} instructions`,
    provider: 'openai.chat',
    modelId: 'gpt-4o',
    workflows: {},
    agents: {},
    tools: {},
  }) as unknown as GetAgentResponse;

const agents = [agent('agent-a', 'Agent A'), agent('agent-b', 'Agent B'), agent('agent-c', 'Agent C')];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <AgentsList agents={agents} isLoading={false} hasSearch={false} />
    </TestLinkProvider>,
  );

describe('AgentsList keyboard navigation', () => {
  it('applies a roving tabindex to the row link inside each RowWrapper', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    // The focus target is the inner RowLink anchor, not the wrapper.
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  it('keeps row links navigable (href preserved on the focus target)', () => {
    renderList();

    expect(interactiveRows().map(row => row.getAttribute('href'))).toEqual([
      '/agents/agent-a',
      '/agents/agent-b',
      '/agents/agent-c',
    ]);
  });
});
