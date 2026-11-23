// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageCard } from '../usage-card';
import { failingMetrics, openViewMenu, pendingMetrics, renderInMetrics } from './metrics-msw';

describe('UsageCard', () => {
  it('shows its title and view menu while the data loads', async () => {
    pendingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await openViewMenu('Usage by agent')).toEqual(['Usage by agent', 'Usage by model', 'Usage by thread']);
  });

  it('keeps the view menu when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<UsageCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
    expect(await openViewMenu('Usage by agent')).toContain('Usage by model');
  });
});
