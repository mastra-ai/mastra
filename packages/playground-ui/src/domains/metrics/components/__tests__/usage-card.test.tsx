// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsageCard } from '../usage-card';
import { failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('UsageCard', () => {
  it('shows its title and tabs while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<UsageCard />);
    expect(screen.getByText('Usage')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Threads' })).toBeDefined();
  });

  it('reports the clicked thread', async () => {
    seedMetrics();
    const onThreadClick = vi.fn();
    renderInMetrics(<UsageCard onThreadClick={onThreadClick} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Threads' }));
    fireEvent.click(await screen.findByRole('button', { name: /thread-big/ }));
    expect(onThreadClick).toHaveBeenCalledWith('thread-big');
  });

  it('keeps the tabs when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await screen.findByText("Couldn't load")).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Models' })).toBeDefined();
    // No rows, so no column header to label them.
    expect(screen.queryByText('Tokens')).toBeNull();
  });
});
