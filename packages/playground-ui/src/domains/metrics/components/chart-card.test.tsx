// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartCard } from './chart-card';

const views = [
  { value: 'model', label: 'By model' },
  { value: 'provider', label: 'By provider' },
];

describe('ChartCard', () => {
  afterEach(() => cleanup());

  describe('compact', () => {
    it('shows the title and the total on one line, without the description', () => {
      render(
        <ChartCard variant="compact" title="Tokens" description="Input and output." total="992K">
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Tokens' })).toBeTruthy();
      expect(screen.getByText('992K')).toBeTruthy();
      expect(screen.queryByText('Input and output.')).toBeNull();
    });

    it('swaps the total for a skeleton while loading', () => {
      render(
        <ChartCard variant="compact" title="Tokens" total="992K" isLoading>
          <div />
        </ChartCard>,
      );
      expect(screen.queryByText('992K')).toBeNull();
    });
  });

  describe('with a title menu', () => {
    it('switches views from the title', async () => {
      const onValueChange = vi.fn();
      render(
        <ChartCard
          variant="compact"
          title="Spend by model"
          titleMenu={{ value: 'model', onValueChange, options: views }}
        >
          <div />
        </ChartCard>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Spend by model' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'By provider' }));
      expect(onValueChange).toHaveBeenCalledWith('provider');
    });
  });
});
