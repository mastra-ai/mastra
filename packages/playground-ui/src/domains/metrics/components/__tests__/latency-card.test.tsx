// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LatencyCard } from '../latency-card';
import { failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('LatencyCard', () => {
  it('shows its title and tabs while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<LatencyCard />);
    expect(screen.getByText('Latency')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Agents' })).toBeDefined();
    expect(screen.queryByText('4.50s')).toBeNull();
  });

  it('shows the peak P95 once loaded', async () => {
    seedMetrics();
    renderInMetrics(<LatencyCard />);
    expect(await screen.findByText('4.50s')).toBeDefined();
  });

  it('keeps the tabs and says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<LatencyCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Workflows' })).toBeDefined();
  });

  it('has no "View in Traces" button without a handler', async () => {
    seedMetrics();
    renderInMetrics(<LatencyCard />);
    await screen.findByText('4.50s');
    expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
  });

  it('reports the open tab from "View in Traces"', async () => {
    seedMetrics();
    const onViewTraces = vi.fn();
    renderInMetrics(<LatencyCard onViewTraces={onViewTraces} />);
    await screen.findByText('4.50s');
    fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'View in Traces' }));
    expect(onViewTraces).toHaveBeenCalledWith(EntityType.WORKFLOW_RUN);
  });
});
