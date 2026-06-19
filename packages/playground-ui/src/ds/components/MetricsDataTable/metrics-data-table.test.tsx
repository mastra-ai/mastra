// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { MetricsDataTable } from './metrics-data-table';

type Row = {
  key: string;
  model: string;
  input: number;
  output: number;
};

const columns = [
  { label: 'Model', value: (row: Row) => row.model },
  { label: 'Input', value: (row: Row) => row.input.toLocaleString(), highlight: true },
  { label: 'Output', value: (row: Row) => row.output.toLocaleString() },
];

const rows: Row[] = [
  {
    key: '__GATEWAY_OPENAI_MODEL_BASE__',
    model: '__GATEWAY_OPENAI_MODEL_BASE__',
    input: 1200,
    output: 800,
  },
  {
    key: '__GATEWAY_ANTHROPIC_MODEL_SONNET__',
    model: '__GATEWAY_ANTHROPIC_MODEL_SONNET__',
    input: 640,
    output: 320,
  },
];

function TestLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}>{children}</a>;
}

afterEach(() => {
  cleanup();
});

describe('MetricsDataTable', () => {
  it('renders through DataList with sticky row headers', () => {
    const { container } = render(<MetricsDataTable columns={columns} data={rows} />);

    expect(screen.getByText('Model')).not.toBeNull();
    expect(screen.getByText('__GATEWAY_OPENAI_MODEL_BASE__')).not.toBeNull();
    expect(container.querySelector('.data-list-top')).not.toBeNull();
    expect(container.querySelectorAll('.data-list-row')).toHaveLength(2);
    expect(container.querySelectorAll('.data-list-row-header')).toHaveLength(2);
    expect(container.querySelectorAll('.data-list-sticky-start')).toHaveLength(3);
  });

  it('keeps linked rows compatible with the existing LinkComponent prop', () => {
    const { container } = render(
      <MetricsDataTable
        columns={columns}
        data={rows}
        getRowHref={row => `/traces?model=${row.key}`}
        LinkComponent={TestLink}
      />,
    );

    const links = container.querySelectorAll<HTMLAnchorElement>('a.data-list-row');
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute('href')).toBe('/traces?model=__GATEWAY_OPENAI_MODEL_BASE__');
    expect(links[1]?.getAttribute('href')).toBe('/traces?model=__GATEWAY_ANTHROPIC_MODEL_SONNET__');
  });
});
