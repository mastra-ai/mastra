// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TraceVolumeCard } from '../trace-volume-card';
import { failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('TraceVolumeCard', () => {
  it('shows its title and tabs while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(screen.getByText('Trace volume')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Tools' })).toBeDefined();
  });

  it('rows are not clickable without a handler', async () => {
    seedMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(await screen.findByText('Chef Agent')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Chef Agent/ })).toBeNull();
  });

  it('reports the clicked row and the open tab', async () => {
    seedMetrics();
    const onEntityClick = vi.fn();
    renderInMetrics(<TraceVolumeCard onEntityClick={onEntityClick} />);
    fireEvent.click(await screen.findByRole('button', { name: /Chef Agent/ }));
    expect(onEntityClick).toHaveBeenCalledWith(EntityType.AGENT, 'Chef Agent');
  });

  it('reports the open tab from both header buttons', async () => {
    seedMetrics();
    const onViewTraces = vi.fn();
    const onViewErrors = vi.fn();
    renderInMetrics(<TraceVolumeCard onViewTraces={onViewTraces} onViewErrors={onViewErrors} />);
    await screen.findByText('Chef Agent');
    fireEvent.click(screen.getByRole('button', { name: 'View in Traces' }));
    fireEvent.click(screen.getByRole('button', { name: 'View errors in Logs' }));
    expect(onViewTraces).toHaveBeenCalledWith(EntityType.AGENT);
    expect(onViewErrors).toHaveBeenCalledWith(EntityType.AGENT);
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });
});
