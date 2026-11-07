// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartCard } from './chart-card';

const views = [
  { value: 'model', label: 'By model' },
  { value: 'provider', label: 'By provider' },
];

describe('ChartCard', () => {
  afterEach(() => cleanup());

  describe('compact', () => {
    it('shows the title over the total', () => {
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
      // Picking a view closes the menu.
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });

    it("keeps the title as the header's first item, sized to its text, while the menu is open", async () => {
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
      // The menu's own wrapper, in the title's wrapper (with the drag handle's room), in the header.
      const title = trigger.parentElement?.parentElement;
      const header = title?.parentElement;
      // The header stretches its first item; that's the wrapper, so the button keeps its width.
      expect(header?.firstElementChild).toBe(title);
      fireEvent.click(trigger);
      await screen.findByRole('menuitemradio', { name: 'By provider' });
      expect(header?.firstElementChild?.contains(trigger)).toBe(true);
      expect(header?.contains(screen.getByText('$12'))).toBe(true);
    });
  });

  it('adds no legend row to a card that passes no toolbar', () => {
    const { container } = render(
      <ChartCard title="Requests">
        <div />
      </ChartCard>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"].min-h-6')).toHaveLength(0);
  });

  it('keeps an empty legend row when the toolbar is false (nothing to show yet)', () => {
    const { container } = render(
      <ChartCard title="Resources and threads" toolbar={false}>
        <div data-testid="body" />
      </ChartCard>,
    );
    const body = screen.getByTestId('body').parentElement;
    expect(body?.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[aria-hidden="true"].min-h-6')).toHaveLength(1);
  });

  describe('hero', () => {
    it('shows the title as a label over the total, with the change against the previous period', () => {
      render(
        <ChartCard variant="hero" title="Spend sum" total="$138.92" change="+71.4%" actions={<button>Bucket</button>}>
          <div />
        </ChartCard>,
      );
      expect(screen.getByRole('heading', { name: 'Spend sum' })).toBeTruthy();
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

  it('links to a fuller view from an expand button in the corner, with the given link component', () => {
    const Link = ({ href, ...props }: { href: string }) => <a href={`/app${href}`} data-router-link {...props} />;
    render(
      <ChartCard variant="compact" title="Spend by model" href="/query?metric=spend" LinkComponent={Link} total="$12">
        <div />
      </ChartCard>,
    );
    const link = screen.getByRole('link', { name: 'Expand Spend by model' });
    expect(link.getAttribute('href')).toBe('/app/query?metric=spend');
    // The title stays plain text; the link is the button beside it.
    expect(screen.getByRole('heading', { name: 'Spend by model' }).contains(link)).toBe(false);
  });

  it('makes the title the link on a card with no total', () => {
    render(
      <ChartCard title="Spend by model" href="/query">
        <div />
      </ChartCard>,
    );
    const link = screen.getByRole('link', { name: 'Spend by model' });
    expect(link.getAttribute('href')).toBe('/query');
    expect(screen.getByRole('heading', { name: 'Spend by model' }).contains(link)).toBe(true);
  });
});
