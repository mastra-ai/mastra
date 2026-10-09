// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoresCard } from '../scores-card';
import { emptyMetrics, failingMetrics, pendingMetrics, renderInMetrics } from './metrics-msw';

describe('ScoresCard', () => {
  it('shows its title while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<ScoresCard />);
    expect(screen.getByText('Scores')).toBeDefined();
  });

  it('says when the range has no scores', async () => {
    emptyMetrics();
    renderInMetrics(<ScoresCard />);
    expect(await screen.findByText('No scores in this range.')).toBeDefined();
  });

  it('says so when the data fails to load', async () => {
    failingMetrics();
    renderInMetrics(<ScoresCard />);
    expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
  });
});
