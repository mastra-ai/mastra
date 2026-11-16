// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TraceVolumeCard } from '../trace-volume-card';
import { failingMetrics, openViewMenu, pendingMetrics, pickView, renderInMetrics, seedMetrics } from './metrics-msw';

describe('TraceVolumeCard', () => {
  it('shows its title and view menu while the data loads', async () => {
    pendingMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(await openViewMenu('Agent runs')).toEqual(['Agent runs', 'Workflow runs', 'Tool calls']);
  });

  it('totals only the open view', async () => {
    seedMetrics();
    renderInMetrics(<TraceVolumeCard />);
    // Chef Agent: 10 completed and 2 failed runs, in its row and the card total; no workflow ran.
    expect(await screen.findAllByText('12')).toHaveLength(2);
    await pickView('Agent runs', 'Workflow runs');
    expect(await screen.findByText('0')).toBeDefined();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('rows are not clickable without a handler', async () => {
    seedMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(await screen.findByText('Chef Agent')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Chef Agent/ })).toBeNull();
  });

  it('reports the clicked row and the open view', async () => {
    seedMetrics();
    const onEntityClick = vi.fn();
    renderInMetrics(<TraceVolumeCard onEntityClick={onEntityClick} />);
    fireEvent.click(await screen.findByRole('button', { name: /Chef Agent/ }));
    expect(onEntityClick).toHaveBeenCalledWith(EntityType.AGENT, 'Chef Agent');
  });

  it('reports the open view from both header buttons', async () => {
    seedMetrics();
    const onViewTraces = vi.fn();
    const onViewErrors = vi.fn();
    renderInMetrics(<TraceVolumeCard onViewTraces={onViewTraces} onViewErrors={onViewErrors} />);
    await screen.findByText('Chef Agent');
    fireEvent.click(screen.getByRole('button', { name: 'View in traces' }));
    fireEvent.click(screen.getByRole('button', { name: 'View errors in logs' }));
    expect(onViewTraces).toHaveBeenCalledWith(EntityType.AGENT);
    expect(onViewErrors).toHaveBeenCalledWith(EntityType.AGENT);
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<TraceVolumeCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });
});
