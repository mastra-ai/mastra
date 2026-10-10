// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Table } from './index';

afterEach(() => {
  cleanup();
});

const CreditTable = ({ onAction }: { onAction?: () => void }) => (
  <Table aria-label="Credit history">
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

  it('makes a linked row a real link the keyboard reaches first', async () => {
    const user = userEvent.setup();
    render(<CreditTable />);

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
      <Table aria-label="Projects">
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
