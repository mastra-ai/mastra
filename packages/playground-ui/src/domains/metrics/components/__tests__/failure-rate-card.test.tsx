// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FailureRateCard } from '../failure-rate-card';
import { failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';

describe('FailureRateCard', () => {
  it('shows its title while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<FailureRateCard />);
    expect(screen.getByText('Failure rate')).toBeDefined();
    expect(screen.queryByText('20.0%')).toBeNull();
  });

  it('shows the share of runs that failed', async () => {
    seedMetrics();
    renderInMetrics(<FailureRateCard />);
    expect(await screen.findByText('20.0%')).toBeDefined();
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<FailureRateCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });

  it('calls the handler from "View errors in Logs"', async () => {
    seedMetrics();
    const onViewErrors = vi.fn();
    renderInMetrics(<FailureRateCard onViewErrors={onViewErrors} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View errors in Logs' }));
    expect(onViewErrors).toHaveBeenCalledOnce();
  });
});
