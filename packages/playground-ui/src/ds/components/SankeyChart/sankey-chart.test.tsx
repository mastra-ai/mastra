// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SankeyChart } from './sankey-chart';
import { Sankey, useSankey } from './sankey-context';
import { buildSankeyHueMap, nodeColor, nodeColorVivid } from './sankeyColor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320);
});

const data = [
  { channel: 'Search', region: 'EU', outcome: 'Won' },
  { channel: 'Search', region: 'EU', outcome: 'Lost' },
  { channel: 'Search', region: 'US', outcome: 'Won' },
  { channel: 'Referral', region: 'US', outcome: 'Won' },
];

const columns = [
  { id: 'channel', label: 'Channel' },
  { id: 'region', label: 'Region' },
  { id: 'outcome', label: 'Outcome' },
];

function TestControls() {
  const { columns: controlColumns, toggleColumn, reorderColumns } = useSankey();

  return (
    <div>
      {controlColumns.map(column => (
        <button key={column.id} type="button" onClick={() => toggleColumn(column.id)}>
          {column.visible ? 'Hide' : 'Show'} {column.label}
        </button>
      ))}
      <button type="button" onClick={() => reorderColumns(1, 0)}>
        Move second column first
      </button>
    </div>
  );
}

function Example({
  onCurveClick,
  columnOrder,
  onColumnOrderChange,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  getColumnHue,
}: {
  onCurveClick?: (selection: unknown) => void;
  columnOrder?: Array<string>;
  onColumnOrderChange?: (columnOrder: Array<string>) => void;
  visibleColumnIds?: Array<string>;
  onVisibleColumnIdsChange?: (columnIds: Array<string>) => void;
  getColumnHue?: (column: (typeof columns)[number]) => number;
}) {
  return (
    <Sankey
      data={data}
      columns={columns}
      columnOrder={columnOrder}
      onColumnOrderChange={onColumnOrderChange}
      visibleColumnIds={visibleColumnIds}
      onVisibleColumnIdsChange={onVisibleColumnIdsChange}
      getColumnHue={getColumnHue}
    >
      <TestControls />
      <SankeyChart onCurveClick={onCurveClick} />
    </Sankey>
  );
}

describe('SankeyChart', () => {
  it('reports when the renderer is used outside its provider', () => {
    expect(() => render(<SankeyChart />)).toThrow('SankeyChart must be used within Sankey');
  });

  it('reports when the controls hook is used outside its provider', () => {
    function InvalidControls() {
      useSankey();
      return undefined;
    }

    expect(() => render(<InvalidControls />)).toThrow('useSankey must be used within Sankey');
  });

  it('renders the supplied columns', async () => {
    render(
      <Sankey data={data} columns={columns}>
        <SankeyChart />
      </Sankey>,
    );

    expect(await screen.findAllByText('Channel')).not.toHaveLength(0);
    expect(screen.queryByText('Select at least two columns with data to display a flow')).toBeNull();
  });

  describe('when the caller separates node identity from its display label', () => {
    it('renders equal labels as distinct nodes', async () => {
      const { container } = render(
        <Sankey
          data={[
            { channel: 'channel-one', channelLabel: 'Shared channel', region: 'eu', regionLabel: 'Europe' },
            { channel: 'channel-two', channelLabel: 'Shared channel', region: 'us', regionLabel: 'United States' },
          ]}
          columns={columns.slice(0, 2)}
          getRecordNodeId={(record, column) => String(record[column.id])}
          getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
        >
          <SankeyChart />
        </Sankey>,
      );

      await screen.findAllByText('Shared channel');
      expect(
        [...container.querySelectorAll('svg text')].filter(node => node.textContent === 'Shared channel'),
      ).toHaveLength(2);
    });
  });

  describe('when a node label includes a description', () => {
    const description =
      'Looks up relevant knowledge before responding, including all supporting context needed to explain a long theme description without clipping it.';
    const nodeLabel = `Search. ${description}: 1 trace (100%)`;
    const tooltipLabel = `Search: ${description}`;

    function renderDescribedNode() {
      return render(
        <Sankey
          data={[
            {
              channel: 'channel-one',
              channelLabel: `Search\n${description}`,
              region: 'eu',
              regionLabel: 'Europe',
            },
          ]}
          columns={columns.slice(0, 2)}
          getRecordNodeId={(record, column) => String(record[column.id])}
          getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
        >
          <SankeyChart />
        </Sankey>,
      );
    }

    it('shows the description when the node receives focus', async () => {
      renderDescribedNode();
      const node = await screen.findByLabelText(nodeLabel);

      fireEvent.focus(node);

      expect(screen.getByRole('tooltip', { name: tooltipLabel })).not.toBeNull();
    });

    it('shows the description when the node is hovered', async () => {
      renderDescribedNode();
      const node = await screen.findByLabelText(nodeLabel);

      fireEvent.mouseEnter(node);

      expect(screen.getByRole('tooltip', { name: tooltipLabel }).textContent).toContain(description);
    });

    it('keeps the description and ribbons active when the pointer leaves a focused node', async () => {
      const { container } = renderDescribedNode();
      const node = await screen.findByLabelText(nodeLabel);
      fireEvent.focus(node);
      fireEvent.mouseEnter(node);

      fireEvent.mouseLeave(node);

      expect(screen.getByRole('tooltip', { name: tooltipLabel })).not.toBeNull();
      expect(container.querySelector('svg path[fill-opacity]')?.getAttribute('fill-opacity')).toBe('0.75');
    });

    it('keeps the description and ribbons active when a hovered node loses focus', async () => {
      const { container } = renderDescribedNode();
      const node = await screen.findByLabelText(nodeLabel);
      fireEvent.mouseEnter(node);
      fireEvent.focus(node);

      fireEvent.blur(node);

      expect(screen.getByRole('tooltip', { name: tooltipLabel })).not.toBeNull();
      expect(container.querySelector('svg path[fill-opacity]')?.getAttribute('fill-opacity')).toBe('0.75');
    });
  });

  describe('when a node has a long display label', () => {
    it('truncates the visible text and preserves the full accessible label', async () => {
      const longLabel = 'Adding a transcript to a workspace with a very descriptive name';
      const { container } = render(
        <Sankey
          data={[{ channel: 'channel-one', channelLabel: longLabel, region: 'eu', regionLabel: 'Europe' }]}
          columns={columns.slice(0, 2)}
          getRecordNodeId={(record, column) => String(record[column.id])}
          getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
        >
          <SankeyChart />
        </Sankey>,
      );

      await screen.findByText('Adding a transcript to…');
      expect([...container.querySelectorAll('svg title')].map(title => title.textContent)).toContain(longLabel);
      expect(screen.getByLabelText(`${longLabel}: 1 trace (100%)`)).not.toBeNull();
    });
  });

  it('labels each chart column above its nodes', async () => {
    const { container } = render(<Example />);

    await screen.findByText('Search', { selector: 'text' });
    const chartLabels = [...container.querySelectorAll('svg text')].map(element => element.textContent);

    expect(chartLabels).toEqual(expect.arrayContaining(['Channel', 'Region', 'Outcome']));
    const channelLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Channel');
    const outcomeLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Outcome');
    expect(channelLabel?.getAttribute('text-anchor')).toBe('middle');
    expect(outcomeLabel?.getAttribute('text-anchor')).toBe('middle');
    const nodes = [...container.querySelectorAll('svg rect[rx="3"]')];
    const node = nodes[0];
    const nextNode = nodes.find(
      candidate => candidate !== node && candidate.getAttribute('x') === node?.getAttribute('x'),
    );
    expect(node?.getAttribute('x')).toBe('160');
    expect(node?.getAttribute('width')).toBe('7');
    expect(Number(node?.getAttribute('height'))).toBeLessThan(180);
    expect(
      Number(nextNode?.getAttribute('y')) - Number(node?.getAttribute('y')) - Number(node?.getAttribute('height')),
    ).toBeCloseTo(56);
    expect(channelLabel?.getAttribute('x')).toBe('163.5');
    const searchLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Search');
    expect(searchLabel?.getAttribute('font-size')).toBe('11');
    expect(searchLabel?.getAttribute('text-anchor')).toBe('middle');
    expect(searchLabel?.getAttribute('x')).toBe('163.5');
    expect(Number(searchLabel?.getAttribute('y'))).toBeGreaterThan(Number(channelLabel?.getAttribute('y')) + 16);
    expect(Number(searchLabel?.getAttribute('y'))).toBeLessThan(Number(node?.getAttribute('y')));
    expect(searchLabel?.getAttribute('style')).toBeNull();
    const searchDetails = [...container.querySelectorAll('svg text')].find(
      element => element.textContent === '3 (75%)' && element.getAttribute('x') === '163.5',
    );
    expect(searchDetails?.getAttribute('text-anchor')).toBe('middle');
    expect(Number(searchDetails?.getAttribute('y'))).toBeLessThan(Number(node?.getAttribute('y')) - 4);
    const lostLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Lost');
    expect(lostLabel?.getAttribute('text-anchor')).toBe('middle');
    expect(container.querySelector('svg text[font-size="9.5"]')).not.toBeNull();
  });

  it('shows each node count with its percentage of the column total', async () => {
    render(<Example />);

    expect(await screen.findAllByText('3 (75%)')).toHaveLength(2);
    expect(screen.getAllByText('2 (50%)')).toHaveLength(2);
    expect(screen.getAllByText('1 (25%)')).toHaveLength(2);
  });

  describe('when the caller provides chart margins', () => {
    it('positions the first node at the requested left margin', async () => {
      const { container } = render(
        <Sankey data={data} columns={columns}>
          <SankeyChart margin={{ top: 40, right: 24, bottom: 12, left: 24 }} />
        </Sankey>,
      );

      await screen.findByText('Search', { selector: 'text' });

      expect(container.querySelector('svg rect[rx="3"]')?.getAttribute('x')).toBe('24');
    });
  });

  it('uses one repelled hue map for colored nodes and gradient ribbon links', async () => {
    const { container } = render(<Example onCurveClick={() => {}} />);
    const hueMap = buildSankeyHueMap(['Search', 'Referral', 'EU', 'US', 'Won', 'Lost']);

    await screen.findAllByRole('button', { name: 'Select Sankey curve' });

    expect(container.querySelector(`rect[fill="${nodeColor(hueMap.Search ?? 0)}"]`)).not.toBeNull();
    expect(container.querySelector(`stop[stop-color="${nodeColor(hueMap.Search ?? 0)}"]`)).not.toBeNull();
    expect(container.querySelector(`stop[stop-color="${nodeColorVivid(hueMap.EU ?? 0)}"]`)).not.toBeNull();
  });

  describe('when the caller provides column hues', () => {
    it('uses one hue for every node and ribbon endpoint in each column', async () => {
      const columnHues: Record<string, number> = { channel: 24, region: 144, outcome: 264 };
      const { container } = render(
        <Example onCurveClick={() => {}} getColumnHue={column => columnHues[column.id] ?? 0} />,
      );

      await screen.findAllByRole('button', { name: 'Select Sankey curve' });

      expect(container.querySelectorAll(`rect[fill="${nodeColor(columnHues.channel)}"]`)).toHaveLength(2);
      expect(container.querySelectorAll(`rect[fill="${nodeColor(columnHues.region)}"]`)).toHaveLength(2);
      expect(container.querySelectorAll(`rect[fill="${nodeColor(columnHues.outcome)}"]`)).toHaveLength(2);
      expect(screen.getByText('Channel').getAttribute('fill')).toBe(nodeColor(columnHues.channel));
      expect(screen.getByText('Region').getAttribute('fill')).toBe(nodeColor(columnHues.region));
      expect(screen.getByText('Outcome').getAttribute('fill')).toBe(nodeColor(columnHues.outcome));
      expect(container.querySelector(`stop[stop-color="${nodeColor(columnHues.channel)}"]`)).not.toBeNull();
      expect(container.querySelector(`stop[stop-color="${nodeColorVivid(columnHues.region)}"]`)).not.toBeNull();
    });
  });

  it('renders closed gradient ribbons without strokes, filters, or glow', async () => {
    const { container } = render(<Example onCurveClick={() => {}} />);
    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    const firstCurve = curves[0];

    expect(firstCurve?.getAttribute('d')).toMatch(/^M.+ C.+ L.+ C.+ Z$/);
    expect(firstCurve?.getAttribute('fill')).toBe('url(#sankey-grad-0)');
    expect(firstCurve?.getAttribute('fill-opacity')).toBe('0.32');
    expect(firstCurve?.getAttribute('stroke')).toBe('none');
    expect(firstCurve?.getAttribute('filter')).toBeNull();
    expect(container.querySelector('linearGradient[gradientUnits="userSpaceOnUse"]')).not.toBeNull();
  });

  it('brightens every ribbon with the same source and restores them on leave', async () => {
    render(<Example onCurveClick={() => {}} />);
    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    const firstSearchBranch = curves[0];
    const secondSearchBranch = curves[1];
    const referralBranch = curves[2];
    if (!firstSearchBranch || !secondSearchBranch || !referralBranch) {
      throw new Error('Expected Search and Referral branch ribbons');
    }

    fireEvent.mouseEnter(firstSearchBranch);

    expect(firstSearchBranch.getAttribute('fill-opacity')).toBe('0.75');
    expect(secondSearchBranch.getAttribute('fill-opacity')).toBe('0.75');
    expect(referralBranch.getAttribute('fill-opacity')).toBe('0.32');

    fireEvent.mouseLeave(firstSearchBranch);

    expect(firstSearchBranch.getAttribute('fill-opacity')).toBe('0.32');
    expect(secondSearchBranch.getAttribute('fill-opacity')).toBe('0.32');
  });

  it('keeps every connected ribbon bright while hovering a node label', async () => {
    render(<Example onCurveClick={() => {}} />);
    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    const searchLabel = screen.getByText('Search', { selector: 'text' });

    fireEvent.mouseEnter(searchLabel);

    expect(curves[0]?.getAttribute('fill-opacity')).toBe('0.75');
    expect(curves[1]?.getAttribute('fill-opacity')).toBe('0.75');
    expect(curves[2]?.getAttribute('fill-opacity')).toBe('0.32');
  });

  it('lets user-land controls toggle columns and recomputes the rendered flow', async () => {
    render(<Example />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide Region' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Outcome' }));

    expect(screen.getByText('Select at least two columns with data to display a flow')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show Region' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show Region' }));
    await waitFor(() =>
      expect(screen.queryByText('Select at least two columns with data to display a flow')).toBeNull(),
    );
  });

  it('reports the next visible columns from controlled user-land controls', () => {
    const onVisibleColumnIdsChange = vi.fn();
    render(
      <Example
        visibleColumnIds={['channel', 'region', 'outcome']}
        onVisibleColumnIdsChange={onVisibleColumnIdsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide Region' }));

    expect(onVisibleColumnIdsChange).toHaveBeenCalledWith(['channel', 'outcome']);
  });

  it('lifts the selected link metadata and contributing records by mouse and keyboard', async () => {
    const onCurveClick = vi.fn();
    render(<Example onCurveClick={onCurveClick} />);

    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    fireEvent.click(curves[0]);

    expect(onCurveClick).toHaveBeenCalledWith({
      source: { column: { id: 'channel', label: 'Channel' }, value: 'Search' },
      target: { column: { id: 'region', label: 'Region' }, value: 'EU' },
      records: [data[0], data[1]],
    });

    fireEvent.keyDown(curves[0], { key: 'Enter' });
    await waitFor(() => expect(onCurveClick).toHaveBeenCalledTimes(2));
  });

  it('lets user-land controls reorder columns and recomputes curve metadata', async () => {
    const onCurveClick = vi.fn();
    render(<Example onCurveClick={onCurveClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move second column first' }));
    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    fireEvent.click(curves[0]);

    expect(onCurveClick).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({ column: { id: 'region', label: 'Region' } }),
        target: expect.objectContaining({ column: { id: 'channel', label: 'Channel' } }),
      }),
    );
  });

  it('reports the next column order from controlled user-land controls', () => {
    const onColumnOrderChange = vi.fn();
    render(<Example columnOrder={['channel', 'region', 'outcome']} onColumnOrderChange={onColumnOrderChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move second column first' }));

    expect(onColumnOrderChange).toHaveBeenCalledWith(['region', 'channel', 'outcome']);
  });
});
