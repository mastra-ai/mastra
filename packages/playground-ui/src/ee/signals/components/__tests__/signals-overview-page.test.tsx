// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalsOverviewPage } from '../signals-overview-page';

afterEach(() => cleanup());

describe('SignalsOverviewPage', () => {
  describe('when Signals has not launched yet', () => {
    it('explains how traces will become signal analysis', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Traces' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Mastra Engine' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Signal analysis' })).not.toBeNull();
      expect(screen.getByText('Outcome')).not.toBeNull();
      expect(screen.getByText('Goal')).not.toBeNull();
      expect(screen.getByText('Behavior')).not.toBeNull();
      expect(screen.getByText('Sentiment')).not.toBeNull();
    });
  });
});
