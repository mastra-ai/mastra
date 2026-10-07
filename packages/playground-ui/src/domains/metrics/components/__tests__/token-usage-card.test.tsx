// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenUsageCard } from '../token-usage-card';
import { failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('TokenUsageCard', () => {
  it('shows its title and tabs while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(screen.getByText('Token usage')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cost' })).toBeDefined();
    expect(screen.queryByText('1.30K')).toBeNull();
  });

  it('shows the token total, then the cost', async () => {
    seedMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(await screen.findByText('1.30K')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(await screen.findByText('$0.75')).toBeDefined();
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<TokenUsageCard />);
    expect(await screen.findByText("Couldn't load")).toBeDefined();
  });

  it('only offers "View in Traces" with a handler, and calls it', async () => {
    seedMetrics();
    const onViewTraces = vi.fn();
    const { unmount } = renderInMetrics(<TokenUsageCard />);
    await screen.findByText('1.30K');
    expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
    unmount();
    renderInMetrics(<TokenUsageCard onViewTraces={onViewTraces} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View in Traces' }));
    expect(onViewTraces).toHaveBeenCalledOnce();
  });
});
