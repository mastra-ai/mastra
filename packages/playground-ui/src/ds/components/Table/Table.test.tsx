// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cell, TxtCell, EntryCell, DateTimeCell } from './Cells';
import { Table, Thead, Th, Tbody, Row } from './Table';

afterEach(() => {
  cleanup();
});

const CreditTable = ({ onAction }: { onAction?: () => void }) => (
  <Table variant="inset" aria-label="Credit history">
    <Table.Header>
      <Table.Row>
        <Table.Head>Type</Table.Head>
        <Table.Head align="end">Balance</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      <Table.Row>
        <Table.Cell>
          <Table.RowLink href="/credits/1">Credit grant</Table.RowLink>
        </Table.Cell>
        <Table.Cell align="end">
          <button type="button" onClick={onAction}>
            Refund
          </button>
        </Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Cell>Top-up</Table.Cell>
        <Table.Cell align="end">$0.00</Table.Cell>
      </Table.Row>
    </Table.Body>
  </Table>
);

describe('Table', () => {
  it('renders a named table with column headers and cells', () => {
    render(<CreditTable />);

    const table = screen.getByRole('table', { name: 'Credit history' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(head => head.textContent),
    ).toEqual(['Type', 'Balance']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: '$0.00' })).toBeTruthy();
  });

  it('lets the keyboard reach a real row link after the scrollable table', async () => {
    const user = userEvent.setup();
    render(<CreditTable />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('table', { name: 'Credit history' }));
    await user.tab();

    const link = screen.getByRole('link', { name: 'Credit grant' });
    expect(link.getAttribute('href')).toBe('/credits/1');
    expect(document.activeElement).toBe(link);
  });

  it('keeps other controls in a linked row independently clickable', () => {
    const onAction = vi.fn();
    render(<CreditTable onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders the row link through a router link component', () => {
    const RouterLink = ({ to, ...props }: { to: string } & ComponentProps<'a'>) => <a href={to} {...props} />;
    render(
      <Table variant="inset" aria-label="Projects">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Table.RowLink render={<RouterLink to="/projects/support-agent" />}>support-agent</Table.RowLink>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );

    expect(screen.getByRole('link', { name: 'support-agent' }).getAttribute('href')).toBe('/projects/support-agent');
  });
});

function legacyMarkup(size?: 'default' | 'small') {
  return renderToStaticMarkup(
    <Table size={size} className="max-w-full" style={{ width: 600 }}>
      <Thead className="relative">
        <Th>Name</Th>
        <Th>Status</Th>
      </Thead>
      <Tbody data-testid="legacy-body">
        <Row selected className="relative">
          <TxtCell>Selected</TxtCell>
          <Cell>
            <button>Action</button>
          </Cell>
        </Row>
        <Row onClick={() => {}}>
          <EntryCell name="Agent" description="Description" />
          <DateTimeCell dateTime={new Date('2020-08-31T13:07:05Z')} />
        </Row>
      </Tbody>
    </Table>,
  );
}

it('preserves legacy default markup', () => {
  expect(legacyMarkup()).toMatchInlineSnapshot(
    `"<table class="w-full [&amp;&gt;tbody&gt;tr]:h-table-row max-w-full" style="width:600px"><thead><tr class="h-table-header border-b border-border bg-card relative"><th class="h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3">Name</th><th class="h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3">Status</th></tr></thead><tbody class="" data-testid="legacy-body"><tr class="border-b border-border transition-colors duration-normal ease-out-custom hover:bg-fill-subtle focus:bg-fill-subtle focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1 bg-fill-hover relative"><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><span class="text-body-sm w-full truncate">Selected</span></div></td><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><button>Action</button></div></td></tr><tr class="border-b border-border transition-colors duration-normal ease-out-custom hover:bg-fill-subtle focus:bg-fill-subtle focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1 cursor-pointer" tabindex="0"><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><div class="flex items-center gap-3.5"><div class="flex flex-col gap-0"><span class="text-body text-foreground">Agent</span><span class="text-meta text-muted-foreground w-full max-w-75 truncate pt-1">Description</span></div></div></div></td><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><span class="text-body shrink-0">Aug 31, 2020, 1:07:05 PM</span></div></td></tr></tbody></table>"`,
  );
});

it('preserves legacy small markup', () => {
  expect(legacyMarkup('small')).toMatchInlineSnapshot(
    `"<table class="w-full [&amp;&gt;tbody&gt;tr]:h-table-row-small max-w-full" style="width:600px"><thead><tr class="h-table-header border-b border-border bg-card relative"><th class="h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3">Name</th><th class="h-full text-left text-meta tracking-wide whitespace-nowrap text-placeholder uppercase first:pl-3 last:pr-3">Status</th></tr></thead><tbody class="" data-testid="legacy-body"><tr class="border-b border-border transition-colors duration-normal ease-out-custom hover:bg-fill-subtle focus:bg-fill-subtle focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1 bg-fill-hover relative"><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><span class="text-body-sm w-full truncate">Selected</span></div></td><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><button>Action</button></div></td></tr><tr class="border-b border-border transition-colors duration-normal ease-out-custom hover:bg-fill-subtle focus:bg-fill-subtle focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1 cursor-pointer" tabindex="0"><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><div class="flex items-center gap-3.5"><div class="flex flex-col gap-0"><span class="text-body text-foreground">Agent</span><span class="text-meta text-muted-foreground w-full max-w-75 truncate pt-1">Description</span></div></div></div></td><td class="text-foreground first:pl-3 last:pr-3"><div class="flex size-full shrink-0 items-center"><span class="text-body shrink-0">Aug 31, 2020, 1:07:05 PM</span></div></td></tr></tbody></table>"`,
  );
});

it('applies the inset variant to the existing named parts without nesting header rows', () => {
  render(
    <Table variant="inset" aria-label="Resources" columnDividers>
      <Thead>
        <Th>Agent</Th>
        <Th>Resource</Th>
      </Thead>
      <Tbody>
        <Row>
          <Cell>support-agent</Cell>
          <Cell>vCPU</Cell>
        </Row>
        <Row>
          <Cell>research-workflows</Cell>
          <Cell>Memory</Cell>
        </Row>
      </Tbody>
    </Table>,
  );
  const table = screen.getByRole('table', { name: 'Resources' });
  expect(table.querySelectorAll('thead > tr')).toHaveLength(1);
  expect(table.querySelector('tr tr')).toBeNull();
  const agent = screen.getByRole('cell', { name: 'support-agent' });
  expect(agent.firstElementChild).toBeNull();
  expect(screen.getByRole('cell', { name: 'Memory' })).toBeTruthy();
});

it('marks an inset header placed inside the panel, and only on inset tables', () => {
  const { rerender } = render(
    <Table variant="inset" aria-label="Usage by project">
      <Table.Header placement="inside">
        <Table.Row>
          <Table.Head>Project</Table.Head>
        </Table.Row>
      </Table.Header>
    </Table>,
  );
  const header = () => screen.getByRole('table', { name: 'Usage by project' }).querySelector('thead');
  expect(header()?.dataset.placement).toBe('inside');

  rerender(
    <Table aria-label="Usage by project">
      <Table.Header placement="inside">
        <Table.Row>
          <Table.Head>Project</Table.Head>
        </Table.Row>
      </Table.Header>
    </Table>,
  );
  expect(header()?.dataset.placement).toBeUndefined();
});

it('forwards native table and cell refs in inset mode', () => {
  const tableRef = createRef<HTMLTableElement>();
  const cellRef = createRef<HTMLTableCellElement>();
  render(
    <Table variant="inset" ref={tableRef} aria-label="Usage" style={{ width: 400 }}>
      <Table.Body>
        <Table.Row>
          <Table.Cell ref={cellRef} colSpan={2}>
            No usage
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>,
  );
  expect(tableRef.current).toBe(screen.getByRole('table', { name: 'Usage' }));
  expect(tableRef.current?.style.width).toBe('400px');
  expect(cellRef.current).toBe(screen.getByRole('cell', { name: 'No usage' }));
  expect(cellRef.current?.colSpan).toBe(2);
});

it('keeps legacy row actions reachable by keyboard', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <Table>
      <Tbody>
        <Row onClick={onClick}>
          <Cell>Open agent</Cell>
        </Row>
      </Tbody>
    </Table>,
  );
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('row'));
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledTimes(1);
});

function pageLabel(item: HTMLLIElement) {
  if (item.textContent === 'More pages') return '…';
  return item.textContent;
}

function pageLabels() {
  const nav = screen.getByRole('navigation', { name: 'Pagination' });
  return Array.from(nav.querySelectorAll('li'), pageLabel);
}

describe('Table.Pagination', () => {
  it('shows every page when there are seven or fewer', () => {
    render(<Table.Pagination page={0} pageCount={3} onPageChange={() => {}} />);
    expect(pageLabels()).toEqual(['Previous', '1', '2', '3', 'Next']);
  });

  it.each([
    [0, ['Previous', '1', '2', '3', '4', '5', '…', '24', 'Next']],
    [5, ['Previous', '1', '…', '5', '6', '7', '…', '24', 'Next']],
    [23, ['Previous', '1', '…', '20', '21', '22', '23', '24', 'Next']],
    [2, ['Previous', '1', '2', '3', '4', '5', '…', '24', 'Next']],
  ])('collapses distant pages around page index %i', (page, expected) => {
    render(<Table.Pagination page={page} pageCount={24} onPageChange={() => {}} />);
    expect(pageLabels()).toEqual(expected);
  });

  it('marks the current page and reports zero-based page changes', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Table.Pagination page={1} pageCount={3} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange.mock.calls).toEqual([[2], [0], [2]]);
  });

  it('keeps boundary buttons focusable but inert', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Table.Pagination page={0} pageCount={1} onPageChange={onPageChange} />);

    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(previous);
    await user.keyboard('{Enter}');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('renders outside the table as a named navigation landmark', () => {
    render(
      <>
        <CreditTable />
        <Table.Pagination aria-label="Credit pages" page={0} pageCount={2} onPageChange={() => {}} />
      </>,
    );
    const nav = screen.getByRole('navigation', { name: 'Credit pages' });
    expect(screen.getByRole('table', { name: 'Credit history' }).contains(nav)).toBe(false);
  });
});

describe('Table.SortButton', () => {
  it('names the button by its label and reports clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Table variant="inset" aria-label="Credits">
        <Table.Header>
          <Table.Row>
            <Table.Head align="end" aria-sort="descending">
              <Table.SortButton direction="descending" onClick={onClick}>
                Balance
              </Table.SortButton>
            </Table.Head>
          </Table.Row>
        </Table.Header>
      </Table>,
    );
    const button = screen.getByRole('button', { name: 'Balance' });
    expect(button.hasAttribute('data-sorted')).toBe(true);
    expect(screen.getByRole('columnheader', { name: 'Balance' }).getAttribute('aria-sort')).toBe('descending');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Table.RowButton', () => {
  it('makes the row one button that keeps other row controls independent', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onRefund = vi.fn();
    render(
      <Table variant="inset" aria-label="Credits">
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <Table.RowButton onClick={onOpen}>Credit grant</Table.RowButton>
            </Table.Cell>
            <Table.Cell align="end">
              <button type="button" onClick={onRefund}>
                Refund
              </button>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );

    const open = screen.getByRole('button', { name: 'Credit grant' });
    expect(open.getAttribute('type')).toBe('button');
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(open);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Refund' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRefund).toHaveBeenCalledTimes(1);
  });
});

it('forwards the legacy row ref to the rendered tr', () => {
  const rowRef = createRef<HTMLTableRowElement>();
  render(
    <Table>
      <Tbody>
        <Row ref={rowRef}>
          <Cell>Item</Cell>
        </Row>
      </Tbody>
    </Table>,
  );
  expect(rowRef.current).toBe(screen.getByRole('row'));
});

it('maps start and end alignment to valid native attributes in the default variant', () => {
  render(
    <Table>
      <Thead>
        <Th align="end">Balance</Th>
      </Thead>
      <Tbody>
        <Row>
          <Cell align="end">$6.95</Cell>
        </Row>
      </Tbody>
    </Table>,
  );
  expect(screen.getByRole('columnheader', { name: 'Balance' }).getAttribute('align')).toBe('right');
  expect(screen.getByRole('cell', { name: '$6.95' }).getAttribute('align')).toBe('right');
});

it('names collapsed page ranges for screen readers', () => {
  render(<Table.Pagination page={10} pageCount={24} onPageChange={() => {}} />);
  expect(screen.getAllByText('More pages')).toHaveLength(2);
});
