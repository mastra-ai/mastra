// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsageCard } from '../usage-card';
import { failingMetrics, openViewMenu, pendingMetrics, pickView, renderInMetrics, seedMetrics } from './metrics-msw';

describe('UsageCard', () => {
  it('shows its title and view menu while the data loads', async () => {
    pendingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await openViewMenu('Usage by agent')).toEqual(['Usage by agent', 'Usage by model', 'Usage by thread']);
  });

  it('reports the clicked thread', async () => {
    seedMetrics();
    const onThreadClick = vi.fn();
    renderInMetrics(<UsageCard onThreadClick={onThreadClick} />);
    await screen.findByRole('button', { name: 'Usage by agent' });
    await pickView('Usage by agent', 'Usage by thread');
    fireEvent.click(await screen.findByRole('button', { name: /thread-big/ }));
    expect(onThreadClick).toHaveBeenCalledWith('thread-big');
  });

  it('keeps the view menu when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
    expect(await openViewMenu('Usage by agent')).toContain('Usage by model');
  });
});
