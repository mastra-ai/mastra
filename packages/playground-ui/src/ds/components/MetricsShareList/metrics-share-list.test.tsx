// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricsShareList } from './metrics-share-list';
import type { MetricsShareListRow } from './metrics-share-list';

const row = (key: string, share: number, extra: Partial<MetricsShareListRow> = {}): MetricsShareListRow => ({
  key,
  label: key,
  share,
  value: String(share),
  ...extra,
});

const labels = () => screen.getAllByRole('listitem').map(li => li.textContent ?? '');
const strip = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLSpanElement>('.h-2 > span')].map(s => s.style.flex);

describe('MetricsShareList', () => {
  afterEach(() => cleanup());

  it('ranks rows by share, largest first, with each row’s share of the total', () => {
    render(<MetricsShareList rows={[row('b', 25), row('a', 75)]} valueLabel="Runs" />);
    const items = labels();
    expect(items[0]).toContain('a');
    expect(items[0]).toContain('75%');
    expect(items[1]).toContain('b');
    expect(items[1]).toContain('25%');
  });

  it('folds rows past the limit into one Other row with the caller’s totals', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k, i) => row(k, 70 - i * 10));
    render(
      <MetricsShareList rows={rows} valueLabel="Runs" limit={3} other={rest => ({ value: `${rest.length} folded` })} />,
    );
    const items = labels();
    expect(items).toHaveLength(4);
    expect(items[3]).toContain('Other (4)');
    expect(items[3]).toContain('4 folded');
  });

  it('shows a single extra row instead of an Other row that would hide just one', () => {
    render(<MetricsShareList rows={['a', 'b', 'c', 'd'].map(k => row(k, 1))} valueLabel="Runs" limit={3} />);
    expect(labels().some(l => l.includes('Other'))).toBe(false);
    expect(labels()).toHaveLength(4);
  });

  it('pages long lists in with Show more, and back with Show top', () => {
    const rows = Array.from({ length: 120 }, (_, i) => row(`r${i}`, 1000 - i));
    render(<MetricsShareList rows={rows} valueLabel="Requests" limit={15} overflow="more" pageSize={50} />);
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
    const { rerender } = render(<MetricsShareList rows={rows} valueLabel="Runs" limit={5} overflow="more" />);
    expect(screen.getByText('5 of 30')).toBeTruthy();
    rerender(<MetricsShareList rows={rows} valueLabel="Runs" limit={15} overflow="more" />);
    expect(screen.getByText('15 of 30')).toBeTruthy();
  });

  it('keeps the active row listed even when it ranks past the shown rows', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(`r${i}`, 100 - i));
    render(<MetricsShareList rows={rows} valueLabel="Requests" limit={5} overflow="more" activeKey="r20" />);
    expect(labels().some(l => l.startsWith('r20'))).toBe(true);
  });

  it('caps the strip at 50 own segments and folds the tail into one gray segment', () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => row(`r${i}`, 10_000 - i));
    const { container } = render(
      <MetricsShareList rows={rows} valueLabel="Requests" limit={15} overflow="more" palette="hues" />,
    );
    expect(strip(container)).toHaveLength(16); // 15 shown + one for everything else
    fireEvent.click(screen.getByRole('button', { name: /Show 50 more/ }));
    expect(strip(container)).toHaveLength(51);
  });

  it('draws no segment for a zero share and survives a zero total', () => {
    const { container } = render(<MetricsShareList rows={[row('a', 0), row('b', 0), row('c', 3)]} valueLabel="Runs" />);
    expect(strip(container)).toHaveLength(1);
    const { container: empty } = render(<MetricsShareList rows={[row('x', 0), row('y', 0)]} valueLabel="Runs" />);
    expect(strip(empty)).toHaveLength(0);
    expect(within(empty).getAllByText('0%').length).toBeGreaterThan(0);
  });

  it('treats NaN, negative and infinite shares as zero', () => {
    render(
      <MetricsShareList
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
    const { rerender } = render(<MetricsShareList rows={[]} valueLabel="Runs" emptyState="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    rerender(<MetricsShareList rows={[row('a', 1)]} valueLabel="Runs" isLoading limit={5} />);
    expect(screen.getByRole('list').getAttribute('aria-busy')).toBe('true');
    expect(screen.getAllByRole('listitem')).toHaveLength(6); // limit + the Other row
    expect(screen.queryByText('a')).toBeNull();
  });

  it('renders link rows with the router link, and button rows that run their action', () => {
    const onClick = vi.fn();
    const Link = ({ href, ...props }: { href: string }) => <a data-router href={href} {...props} />;
    render(
      <MetricsShareList
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
    render(<MetricsShareList rows={[row('a', 2), row('b', 1)]} valueLabel="Runs" />);
    const [a, b] = screen.getAllByRole('listitem').map(li => li.firstElementChild as HTMLElement);
    if (!a || !b) throw new Error('expected two rows');
    fireEvent.mouseEnter(a);
    expect(b.style.opacity).toBe('0.5');
    expect(a.style.opacity).toBe('1');
  });

  it('leads the hues with a custom color without repeating the default green', () => {
    const rows = ['a', 'b', 'c'].map((k, i) => row(k, 3 - i));
    const { container } = render(
      <MetricsShareList rows={rows} valueLabel="Runs" palette="hues" color="var(--chart-amber)" />,
    );
    const colors = [...container.querySelectorAll<HTMLSpanElement>('.h-2 > span')].map(s => s.style.backgroundColor);
    expect(colors).toEqual(['var(--chart-amber)', 'var(--chart-share-2)', 'var(--chart-share-3)']);
  });
});
