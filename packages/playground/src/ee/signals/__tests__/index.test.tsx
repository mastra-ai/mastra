// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SignalsOverviewPage from '..';

afterEach(() => cleanup());

describe('Signals page', () => {
  describe('when the route renders', () => {
    it('shows the Signals onboarding empty state', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Signal analysis' })).not.toBeNull();
    });
  });
});
