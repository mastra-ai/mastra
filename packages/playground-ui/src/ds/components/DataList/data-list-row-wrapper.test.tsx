// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataListRowWrapper } from './data-list-row-wrapper';

afterEach(cleanup);

describe('DataListRowWrapper', () => {
  it('is not focusable and ignores clicks without onSelectRow', () => {
    render(<DataListRowWrapper data-testid="row">content</DataListRowWrapper>);
    const row = screen.getByTestId('row');
    expect(row.hasAttribute('tabindex')).toBe(false);
    expect(() => fireEvent.click(row)).not.toThrow();
  });

  it('becomes focusable and activates on click / Enter with onSelectRow', () => {
    const onSelectRow = vi.fn();
    render(
      <DataListRowWrapper data-testid="row" onSelectRow={onSelectRow}>
        content
      </DataListRowWrapper>,
    );
    const row = screen.getByTestId('row');
    expect(row.getAttribute('tabindex')).toBe('0');

    fireEvent.click(row);
    expect(onSelectRow).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelectRow).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: ' ' });
    expect(onSelectRow).toHaveBeenCalledTimes(2);
  });

  it('does not activate when Enter is fired on a focusable child', () => {
    const onSelectRow = vi.fn();
    render(
      <DataListRowWrapper onSelectRow={onSelectRow}>
        <a href="/somewhere">link</a>
      </DataListRowWrapper>,
    );
    fireEvent.keyDown(screen.getByText('link'), { key: 'Enter' });
    expect(onSelectRow).not.toHaveBeenCalled();
  });

  it('does not activate when a child stops click propagation', () => {
    const onSelectRow = vi.fn();
    render(
      <DataListRowWrapper onSelectRow={onSelectRow}>
        <button type="button" onClick={event => event.stopPropagation()}>
          action
        </button>
      </DataListRowWrapper>,
    );
    fireEvent.click(screen.getByText('action'));
    expect(onSelectRow).not.toHaveBeenCalled();
  });

  it('lets spread tabIndex override the default and still calls spread onKeyDown', () => {
    const onSelectRow = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <DataListRowWrapper data-testid="row" onSelectRow={onSelectRow} tabIndex={-1} onKeyDown={onKeyDown}>
        content
      </DataListRowWrapper>,
    );
    const row = screen.getByTestId('row');
    expect(row.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(row, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSelectRow).not.toHaveBeenCalled();

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onSelectRow).toHaveBeenCalledTimes(1);
  });
});
