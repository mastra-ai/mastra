// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoresCard } from '../scores-card';
import { pendingMetrics, renderInMetrics } from './metrics-msw';

describe('ScoresCard', () => {
  it('shows its title while the data loads', () => {
    pendingMetrics();
    renderInMetrics(<ScoresCard />);
    expect(screen.getByText('Scores')).toBeDefined();
  });
});
