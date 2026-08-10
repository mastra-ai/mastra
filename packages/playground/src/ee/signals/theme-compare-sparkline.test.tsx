// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeCompareSparkline } from './theme-compare-sparkline';

describe('ThemeCompareSparkline', () => {
  describe('when loaded samples are separated by an unloaded snapshot', () => {
    it('renders separate line segments on either side of the gap', () => {
      const { container } = render(
        <ThemeCompareSparkline
          series={[0.1, 0.2, undefined, 0.3, 0.4]}
          positions={[0, 25, 50, 75, 100]}
          markerIndexes={[]}
        />,
      );

      expect(container.querySelectorAll('polyline')).toHaveLength(2);
    });
  });
});
