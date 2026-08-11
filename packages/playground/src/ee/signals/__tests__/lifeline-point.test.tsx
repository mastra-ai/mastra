// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LifelinePoint } from '../lifeline-point';

describe('LifelinePoint', () => {
  describe('when the point does not select a theme', () => {
    it('exposes its tooltip from the keyboard', () => {
      render(
        <LifelinePoint
          title="Unlinked theme · Jul 1, 2026 · 3 traces (10%)"
          positionPercent={50}
          height={12}
          color="green"
          onSelect={undefined}
        />,
      );

      fireEvent.focus(screen.getByRole('img', { name: /Unlinked theme/ }));

      expect(screen.getByRole('tooltip').textContent).toContain('Unlinked theme');
    });
  });
});
