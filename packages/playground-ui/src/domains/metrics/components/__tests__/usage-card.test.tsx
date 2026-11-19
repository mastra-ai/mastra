// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsageCard } from '../usage-card';
import { failingMetrics, pendingMetrics, pickView, renderInMetrics, seedMetrics, viewTabs } from './metrics-msw';

describe('UsageCard', () => {
  it('shows its title and view tabs while the data loads', async () => {
    pendingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await viewTabs('Usage')).toEqual(['Agents', 'Models', 'Threads']);
  });

  it('reports the clicked thread', async () => {
    seedMetrics();
    const onThreadClick = vi.fn();
    renderInMetrics(<UsageCard onThreadClick={onThreadClick} />);
    await pickView('Usage', 'Threads');
    fireEvent.click(await screen.findByRole('button', { name: /thread-big/ }));
    expect(onThreadClick).toHaveBeenCalledWith('thread-big');
  });

  it('keeps its tabs while switching views, as the other cards do', async () => {
    seedMetrics();
    renderInMetrics(<UsageCard />);
    const tabs = await screen.findByRole('tablist');
    await pickView('Usage', 'Threads');
    expect(await screen.findByText('thread-big')).toBeDefined();
    expect(screen.getByRole('tablist')).toBe(tabs);
  });

  it('keeps the view tabs when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
    expect(await viewTabs('Usage')).toContain('Models');
  });
});
