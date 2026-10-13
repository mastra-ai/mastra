// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination';
import { getPaginationRange } from './pagination-range';
import type { PaginationRangeItem } from './pagination-range';

afterEach(cleanup);

function label(item: PaginationRangeItem) {
  if (item.kind === 'ellipsis') return '…';
  return String(item.page + 1);
}

describe('getPaginationRange', () => {
  it('returns every page when there are seven or fewer', () => {
    expect(getPaginationRange(0, 4).map(label)).toEqual(['1', '2', '3', '4']);
  });

  it.each([
    [0, ['1', '2', '3', '4', '5', '…', '24']],
    [2, ['1', '2', '3', '4', '5', '…', '24']],
    [9, ['1', '…', '9', '10', '11', '…', '24']],
    [23, ['1', '…', '20', '21', '22', '23', '24']],
  ])('collapses distant pages around page index %i', (page, expected) => {
    expect(getPaginationRange(page, 24).map(label)).toEqual(expected);
  });

  it('returns nothing when there are no pages', () => {
    expect(getPaginationRange(0, 0)).toEqual([]);
  });
});

describe('Pagination', () => {
  it('renders a named navigation landmark with a list of pages', () => {
    render(
      <Pagination aria-label="Credit history pages">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const nav = screen.getByRole('navigation', { name: 'Credit history pages' });
    expect(nav.querySelectorAll('ul > li')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '1' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('More pages')).toBeTruthy();
  });

  it('renders page links as anchors when given a render element', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationNext render={<a href="?page=3" />} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const next = screen.getByRole('link', { name: 'Next' });
    expect(next.getAttribute('href')).toBe('?page=3');
    expect(next.hasAttribute('type')).toBe(false);
  });

  it('keeps a disabled control focusable but ignores its clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled onClick={onClick} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(previous);
    await user.keyboard('{Enter}');
    fireEvent.click(previous);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('drops the href from a disabled anchor but keeps it focusable', async () => {
    const user = userEvent.setup();
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationNext disabled render={<a href="?page=3" />} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const next = screen.getByRole('link', { name: 'Next' });
    expect(next.hasAttribute('href')).toBe(false);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(next);
  });

  it('blocks middle-click on a disabled router link', () => {
    const RouterLink = ({ to, ...props }: { to: string } & ComponentProps<'a'>) => <a href={to} {...props} />;
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationNext disabled render={<RouterLink to="/credits?page=3" />} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const next = screen.getByRole('link', { name: 'Next' });
    const auxClick = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    next.dispatchEvent(auxClick);
    const metaClick = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    next.dispatchEvent(metaClick);
    expect(auxClick.defaultPrevented).toBe(true);
    expect(metaClick.defaultPrevented).toBe(true);
  });
});
