// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenUsageCard } from '../token-usage-card';
import { failingMetrics, openViewMenu, pendingMetrics, pickView, renderInMetrics, seedMetrics } from './metrics-msw';

describe('TokenUsageCard', () => {
  it('shows its title and view menu while the data loads', async () => {
    pendingMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(await openViewMenu('Token usage')).toEqual(['Token usage', 'Model cost']);
    expect(screen.queryByText('1.30K')).toBeNull();
  });

  it('shows the token total, then the cost', async () => {
    seedMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(await screen.findByText('1.30K')).toBeDefined();
    await pickView('Token usage', 'Model cost');
    expect(await screen.findByText('$0.75')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Model cost' })).toBeDefined();
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });

  it('only offers "View in traces" with a handler, and calls it', async () => {
    seedMetrics();
    const onViewTraces = vi.fn();
    const { unmount } = renderInMetrics(<TokenUsageCard />);
    await screen.findByText('1.30K');
    expect(screen.queryByRole('button', { name: 'View in traces' })).toBeNull();
    unmount();
    renderInMetrics(<TokenUsageCard onViewTraces={onViewTraces} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View in traces' }));
    expect(onViewTraces).toHaveBeenCalledOnce();
  });
});
