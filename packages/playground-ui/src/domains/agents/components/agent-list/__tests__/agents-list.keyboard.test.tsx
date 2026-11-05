import type { GetAgentResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const rowLink = (row: HTMLElement) => {
  const link = row.querySelector('a');
  if (!link) throw new Error('Row has no link');
  return link;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentsList keyboard navigation', () => {
  it('applies a roving tabindex to the RowWrapper, with the inner link removed from the tab order', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    // The focus target is the wrapper so the whole row (trailing cells included) is one tab stop.
    expect(rows.every(row => row.tagName === 'DIV')).toBe(true);
    expect(rows.every(row => rowLink(row).getAttribute('tabindex') === '-1')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  it('focuses the first row on ArrowDown from the page body, then moves down', () => {
    renderList();
    const rows = interactiveRows();

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[0]);

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
  });

  it('keeps row links navigable (href preserved on the inner link)', () => {
    renderList();

    expect(interactiveRows().map(row => rowLink(row).getAttribute('href'))).toEqual([
      '/agents/agent-a/threads/new',
      '/agents/agent-b/threads/new',
      '/agents/agent-c/threads/new',
    ]);
  });
});

describe('AgentsList row activation', () => {
  it('activates the link when Enter is pressed on the focused wrapper', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    renderList();
    const [first] = interactiveRows();
    if (!first) throw new Error('Missing row');

    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });

    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toBe(rowLink(first));
  });

  it('activates the link when clicking a non-link area of the row', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    renderList();
    const [first] = interactiveRows();
    if (!first) throw new Error('Missing row');

    fireEvent.click(first);

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('does not re-activate the link when the link itself is clicked', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    renderList();
    const [first] = interactiveRows();
    if (!first) throw new Error('Missing row');

    // fireEvent.click dispatches directly (no programmatic .click()), so any
    // call recorded here would come from the wrapper's onSelectRow.
    fireEvent.click(rowLink(first));

    expect(click).not.toHaveBeenCalled();
  });

  it('does not activate the link when clicking inside a trailing cell', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    renderList();

    fireEvent.click(screen.getByLabelText('Show model details for Agent A'));

    expect(click).not.toHaveBeenCalled();
  });
});
