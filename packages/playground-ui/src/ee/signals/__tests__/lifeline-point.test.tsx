// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
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

      const point = screen.getByRole('img', { name: /Unlinked theme/ });
      act(() => point.focus());

      expect(document.activeElement).toBe(point);
      expect(screen.getByRole('tooltip').textContent).toContain('Unlinked theme');
    });

    it('does not render without a timeline position', () => {
      render(
        <LifelinePoint
          title="Unlinked theme"
          positionPercent={undefined}
          height={12}
          color="green"
          onSelect={undefined}
        />,
      );

      expect(screen.queryByRole('img', { name: 'Unlinked theme' })).toBeNull();
    });
  });
});
