// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TopicTraceSummary } from '../types';
import { TopicTraceSummaryList } from './topic-trace-summary-list';

const makeTrace = (i: number): TopicTraceSummary => ({
  id: `trace-${i}`,
  name: `trace ${i}`,
  startedAt: new Date(`2026-08-2${i + 1}T10:00:00Z`).toISOString(),
});

const renderList = (onTraceSelect = vi.fn()) => {
  render(<TopicTraceSummaryList traces={[makeTrace(2), makeTrace(1), makeTrace(0)]} onTraceSelect={onTraceSelect} />);
  return onTraceSelect;
};

const row = (name: string) => screen.getByRole('button', { name });

afterEach(() => cleanup());

describe('TopicTraceSummaryList keyboard navigation', () => {
  it('uses roving tabindex so only the first row is tabbable', () => {
    renderList();
    const rows = screen.getAllByRole('button').filter(el => el.hasAttribute('data-row-index'));

    expect(rows.map(el => el.tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves focus between rows with arrow keys', () => {
    renderList();
    const rows = screen.getAllByRole('button').filter(el => el.hasAttribute('data-row-index'));
    const [first, second] = rows;
    first?.focus();

    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);

    fireEvent.keyDown(second as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(rows[2]);
  });

  it('still selects a trace on click', () => {
    const onTraceSelect = renderList();

    fireEvent.click(row('trace 1'));
    expect(onTraceSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'trace-1' }));
  });
});
