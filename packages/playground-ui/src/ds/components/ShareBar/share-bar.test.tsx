// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareBar } from './share-bar';
import type { ShareBarRow } from './share-bar-types';

const row = (key: string, share: number, extra: Partial<ShareBarRow> = {}): ShareBarRow => ({
  key,
  label: key,
  share,
  value: String(share),
  ...extra,
});

const labels = () => screen.getAllByRole('listitem').map(li => li.textContent ?? '');
const bar = (container: HTMLElement) =>
  within(container)
    .queryAllByTestId('share-bar-segment')
    .map(s => s.style.flex);

describe('ShareBar', () => {
  afterEach(() => cleanup());

  it('ranks rows by share, largest first, with each row’s share of the total', () => {
    render(<ShareBar rows={[row('b', 25), row('a', 75)]} valueLabel="Runs" />);
    const items = labels();
    expect(items[0]).toContain('a');
    expect(items[0]).toContain('75%');
    expect(items[1]).toContain('b');
    expect(items[1]).toContain('25%');
  });

  it('folds rows past the limit into one Other row with the caller’s totals', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => row(k, 70 - i * 10));
    render(<ShareBar rows={rows} valueLabel="Runs" limit={3} other={rest => ({ value: `${rest.length} folded` })} />);
    const items = labels();
    expect(items).toHaveLength(4);
    expect(items[3]).toContain('Other (4)');
    expect(items[3]).toContain('4 folded');
  });

  it('shows a single extra row instead of an Other row that would hide just one', () => {
    render(<ShareBar rows={['a', 'b', 'c', 'd'].map(k => row(k, 1))} valueLabel="Runs" limit={3} />);
    expect(labels().some(l => l.includes('Other'))).toBe(false);
    expect(labels()).toHaveLength(4);
  });

  it('pages long lists in with Show more, and back with Show top', () => {
    const rows = Array.from({ length: 120 }, (_, i) => row(`r${i}`, 1000 - i));
    render(<ShareBar rows={rows} valueLabel="Requests" limit={15} overflow="more" pageSize={50} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(16); // 15 rows + the footer
    expect(screen.getByText('15 of 120')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show 50 more/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(66);
    fireEvent.click(screen.getByRole('button', { name: /Show 50 more/ }));
    fireEvent.click(screen.getByRole('button', { name: /Show 5 more/ }));
    expect(screen.queryByText(/ of 120/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show top 15/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(16);
  });

  it('follows a new limit after rendering', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(`r${i}`, 100 - i));
    const { rerender } = render(<ShareBar rows={rows} valueLabel="Runs" limit={5} overflow="more" />);
    expect(screen.getByText('5 of 30')).toBeTruthy();
    rerender(<ShareBar rows={rows} valueLabel="Runs" limit={15} overflow="more" />);
    expect(screen.getByText('15 of 30')).toBeTruthy();
  });

  it('caps the bar at 50 own segments and folds the tail into one gray segment', () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => row(`r${i}`, 10_000 - i));
    const { container } = render(
      <ShareBar rows={rows} valueLabel="Requests" limit={15} overflow="more" palette="hues" />,
    );
    expect(bar(container)).toHaveLength(16); // 15 shown + one for everything else
    fireEvent.click(screen.getByRole('button', { name: /Show 50 more/ }));
    expect(bar(container)).toHaveLength(51);
  });

  it('draws no segment for a zero share and survives a zero total', () => {
    const { container } = render(<ShareBar rows={[row('a', 0), row('b', 0), row('c', 3)]} valueLabel="Runs" />);
    expect(bar(container)).toHaveLength(1);
    const { container: empty } = render(<ShareBar rows={[row('x', 0), row('y', 0)]} valueLabel="Runs" />);
    expect(bar(empty)).toHaveLength(0);
    expect(within(empty).getAllByText('0%').length).toBeGreaterThan(0);
  });

  it('fills the bar when the shares sum to less than one', () => {
    const { container } = render(<ShareBar rows={[row('a', 0.03), row('b', 0.01)]} valueLabel="Cost" />);
    const grow = bar(container).map(flex => Number.parseFloat(flex));
    expect(grow).toEqual([75, 25]);
  });

  it('treats NaN, negative and infinite shares as zero', () => {
    render(
      <ShareBar
        rows={[
          row('nan', Number.NaN, { value: 'v' }),
          row('neg', -5, { value: 'v' }),
          row('inf', Number.POSITIVE_INFINITY, { value: 'v' }),
          row('ok', 10),
        ]}
        valueLabel="Runs"
      />,
    );
    const items = labels();
    expect(items[0]).toContain('ok');
    expect(items[0]).toContain('100%');
    expect(items.slice(1).every(l => l.endsWith('0%v'))).toBe(true);
  });

  it('shows the empty state with no rows and skeleton rows while loading', () => {
    const { rerender } = render(<ShareBar rows={[]} valueLabel="Runs" emptyState="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    rerender(<ShareBar rows={[row('a', 1)]} valueLabel="Runs" isLoading limit={5} />);
    expect(screen.getByRole('list').getAttribute('aria-busy')).toBe('true');
    expect(screen.getAllByRole('listitem')).toHaveLength(6); // limit + the Other row
    expect(screen.queryByText('a')).toBeNull();
  });

  it('renders link rows with the router link, and button rows that run their action', () => {
    const onClick = vi.fn();
    const Link = ({ href, ...props }: { href: string }) => <a data-router href={href} {...props} />;
    render(
      <ShareBar
        rows={[row('link', 2, { href: '/traces?agent=link' }), row('button', 1, { onClick })]}
        valueLabel="Runs"
        LinkComponent={Link}
      />,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/traces?agent=link');
    expect(screen.getByRole('link').hasAttribute('data-router')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /button/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('dims the other rows while one is hovered', () => {
    render(<ShareBar rows={[row('a', 2), row('b', 1)]} valueLabel="Runs" />);
    const [a, b] = screen.getAllByRole('listitem').map(li => li.querySelector<HTMLElement>(':scope > *'));
    if (!a || !b) throw new Error('expected two rows');
    fireEvent.mouseEnter(a);
    expect(b.style.opacity).toBe('0.5');
    expect(a.style.opacity).toBe('1');
  });

  it('follows a custom lead color with violet and teal, not the green or sky it may resemble', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => row(k, 6 - i));
    render(<ShareBar rows={rows} valueLabel="Runs" palette="hues" color="var(--chart-blue)" limit={6} />);
    const colors = screen.getAllByTestId('share-bar-segment').map(s => s.style.backgroundColor);
    expect(colors).toEqual([
      'var(--chart-blue)',
      'var(--chart-share-3)',
      'var(--chart-share-4)',
      'var(--chart-share-2)',
      'var(--chart-share-5)',
      'var(--chart-share-1)',
    ]);
  });

  it('puts the column headers between the bar and the rows', () => {
    const { container } = render(<ShareBar rows={[row('a', 3), row('b', 1)]} valueLabel="Spend" />);
    const order = [...(container.firstElementChild?.children ?? [])].map(el =>
      el.querySelector('[data-testid="share-bar-segment"]')
        ? 'bar'
        : el.tagName === 'UL'
          ? 'rows'
          : el.textContent?.includes('Spend')
            ? 'header'
            : 'other',
    );
    expect(order).toEqual(['bar', 'header', 'rows']);
  });
});
