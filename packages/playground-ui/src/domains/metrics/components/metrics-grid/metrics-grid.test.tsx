// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricsGrid } from './metrics-grid';

describe('MetricsGrid', () => {
  describe('when given several cards', () => {
    it('renders them in the order they were passed', () => {
      render(
        <MetricsGrid>
          <MetricsGrid.Item>First</MetricsGrid.Item>
          <MetricsGrid.Item span={2}>Second</MetricsGrid.Item>
          <MetricsGrid.Item span="full">Third</MetricsGrid.Item>
        </MetricsGrid>,
      );

      const texts = screen.getAllByText(/First|Second|Third/).map(node => node.textContent);

      expect(texts).toEqual(['First', 'Second', 'Third']);
    });
  });
});
