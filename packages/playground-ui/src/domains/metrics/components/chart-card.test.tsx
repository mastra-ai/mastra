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
    it('shows the title and the total on one line', () => {
      render(
        <ChartCard variant="compact" title="Tokens" total="992K">
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Tokens' })).toBeTruthy();
      expect(screen.getByText('992K')).toBeTruthy();
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

    it("keeps the title as the top bar's first item, sized to its text, while the menu is open", async () => {
      render(
        <ChartCard
          variant="compact"
          title="Spend by model"
          total="$12"
          titleMenu={{ value: 'model', onValueChange: vi.fn(), options: views }}
        >
          <div />
        </ChartCard>,
      );
      const trigger = screen.getByRole('button', { name: 'Spend by model' });
      const topBar = trigger.parentElement?.parentElement;
      // The top bar stretches its first item; that's the wrapper, so the button keeps its width.
      expect(topBar?.firstElementChild).toBe(trigger.parentElement);
      fireEvent.click(trigger);
      await screen.findByRole('menuitemradio', { name: 'By provider' });
      expect(topBar?.firstElementChild?.contains(trigger)).toBe(true);
      expect(topBar?.lastElementChild?.textContent).toBe('$12');
    });
  });

  describe('hero', () => {
    it('shows the title as a label over the total, with the change against the previous period', () => {
      render(
        <ChartCard variant="hero" title="Spend sum" total="$138.92" change="+71.4%" actions={<button>Bucket</button>}>
          <div />
        </ChartCard>,
      );
      expect(screen.getByText('Spend sum')).toBeTruthy();
      expect(screen.getByText('$138.92')).toBeTruthy();
      expect(screen.getByText('+71.4% vs previous')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bucket' })).toBeTruthy();
    });

    it('swaps the total for a skeleton while loading, without the change', () => {
      render(
        <ChartCard variant="hero" title="Spend sum" total="$138.92" change="+71.4%" isLoading>
          <div />
        </ChartCard>,
      );
      expect(screen.queryByText('$138.92')).toBeNull();
      expect(screen.queryByText('+71.4% vs previous')).toBeNull();
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
      <ChartCard title="Spend by model" href="/query" LinkComponent={Link}>
        <div />
      </ChartCard>,
    );
    expect(screen.getByRole('link', { name: 'Spend by model' }).getAttribute('href')).toBe('/app/query');
  });
});
