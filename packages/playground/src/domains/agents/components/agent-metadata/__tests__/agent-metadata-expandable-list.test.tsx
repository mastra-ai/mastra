import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentMetadataExpandableList } from '../agent-metadata-expandable-list';

const items = Array.from({ length: 12 }, (_, index) => `item-${index + 1}`);

const renderList = (list: string[], limit?: number) =>
  render(
    <AgentMetadataExpandableList
      items={list}
      limit={limit}
      getKey={item => item}
      renderItem={item => <span data-testid="item">{item}</span>}
    />,
  );

describe('AgentMetadataExpandableList', () => {
  it('renders every item and no toggle when the list fits the limit', () => {
    renderList(items.slice(0, 10));

    expect(screen.getAllByTestId('item')).toHaveLength(10);
    expect(screen.queryByTestId('agent-metadata-expandable-toggle')).toBeNull();
  });

  it('caps the list at the limit and shows the number of hidden items', () => {
    renderList(items);

    expect(screen.getAllByTestId('item')).toHaveLength(10);
    const toggle = screen.getByTestId('agent-metadata-expandable-toggle');
    expect(toggle.textContent).toContain('+2');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals the remaining items on click and lets the user collapse again', () => {
    renderList(items);

    fireEvent.click(screen.getByTestId('agent-metadata-expandable-toggle'));
    expect(screen.getAllByTestId('item')).toHaveLength(12);
    const toggle = screen.getByTestId('agent-metadata-expandable-toggle');
    expect(toggle.textContent).toContain('Show less');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(screen.getAllByTestId('item')).toHaveLength(10);
  });

  it('honours a custom limit', () => {
    renderList(items, 3);

    expect(screen.getAllByTestId('item')).toHaveLength(3);
    expect(screen.getByTestId('agent-metadata-expandable-toggle').textContent).toContain('+9');
  });
});
