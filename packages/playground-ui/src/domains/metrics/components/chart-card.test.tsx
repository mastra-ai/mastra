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

  describe('default with a title menu', () => {
    it('keeps the description under the menu', () => {
      render(
        <ChartCard
          title="Spend by model"
          description="Each line is a model."
          titleMenu={{ value: 'model', onValueChange: vi.fn(), options: views }}
        >
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('button', { name: 'Spend by model' })).toBeTruthy();
      expect(screen.getByText('Each line is a model.')).toBeTruthy();
    });
  });

  it('makes the title a link to a fuller view, with the given link component', () => {
    const Link = ({ href, ...props }: { href: string }) => <a href={`/app${href}`} data-router-link {...props} />;
    const { rerender } = render(
      <ChartCard variant="compact" title="Spend by model" href="/query?metric=spend" total="$12">
        <div />
      </ChartCard>,
    );
    const link = screen.getByRole('link', { name: 'Spend by model' });
    expect(link.getAttribute('href')).toBe('/query?metric=spend');
    expect(screen.getByRole('heading', { name: 'Spend by model' }).contains(link)).toBe(true);

    rerender(
      <ChartCard title="Spend by model" description="Each line is a model." href="/query" LinkComponent={Link}>
        <div />
      </ChartCard>,
    );
    expect(screen.getByRole('link', { name: 'Spend by model' }).getAttribute('href')).toBe('/app/query');
    expect(screen.getByText('Each line is a model.')).toBeTruthy();
  });
});
