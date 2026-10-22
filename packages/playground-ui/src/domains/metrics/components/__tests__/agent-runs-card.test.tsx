// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentRunsCard } from '../agent-runs-card';
import { emptyMetrics, failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('AgentRunsCard', () => {
  it('shows its title while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<AgentRunsCard />);
    expect(screen.getByText('Agent runs')).toBeDefined();
    expect(screen.queryByText('runs')).toBeNull();
  });

  it('shows the run count once loaded', async () => {
    seedMetrics();
    renderInMetrics(<AgentRunsCard />);
    expect(await screen.findByText('runs')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
  });

  it('says when the range has no runs', async () => {
    emptyMetrics();
    renderInMetrics(<AgentRunsCard />);
    expect(await screen.findByText('No agent runs in this range.')).toBeDefined();
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<AgentRunsCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });
});
