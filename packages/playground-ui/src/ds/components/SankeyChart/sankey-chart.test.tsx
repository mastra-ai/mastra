// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SankeyChart } from './sankey-chart';
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

function getColumnCheckbox(label: string) {
  const labelElement = screen.getByText(label, { selector: 'span' }).closest('label');
  const checkbox = labelElement?.querySelector<HTMLElement>('[role="checkbox"]');
  if (!checkbox) throw new Error(`Missing ${label} checkbox`);
  return checkbox;
}

function Example({
  onCurveClick,
  columnOrder,
}: {
  onCurveClick?: (selection: unknown) => void;
  columnOrder?: Array<string>;
}) {
  return <SankeyChart data={data} columns={columns} onCurveClick={onCurveClick} columnOrder={columnOrder} />;
}

describe('SankeyChart', () => {
  it('renders the supplied columns', async () => {
    render(<SankeyChart data={data} columns={columns} />);

    expect(await screen.findAllByText('Channel')).not.toHaveLength(0);
    expect(screen.queryByText('Select at least two columns with data to display a flow')).toBeNull();
  });

  it('labels each chart column above its nodes', async () => {
    const { container } = render(<Example />);

    await screen.findByText('Search');
    const chartLabels = [...container.querySelectorAll('svg text')].map(element => element.textContent);

    expect(chartLabels).toEqual(expect.arrayContaining(['Channel', 'Region', 'Outcome']));
    const node = container.querySelector('svg rect[rx="3"]');
    expect(node?.getAttribute('width')).toBe('7');
    const searchLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Search');
    expect(searchLabel?.getAttribute('font-size')).toBe('12.5');
    expect(searchLabel?.getAttribute('paint-order')).toBe('stroke');
    const lostLabel = [...container.querySelectorAll('svg text')].find(element => element.textContent === 'Lost');
    expect(lostLabel?.getAttribute('text-anchor')).toBe('end');
    expect(container.querySelector('svg text[font-size="10.5"]')).not.toBeNull();
  });

  it('uses one repelled hue map for colored nodes and gradient ribbon links', async () => {
    const { container } = render(<Example onCurveClick={() => {}} />);
    const hueMap = buildSankeyHueMap(['Search', 'Referral', 'EU', 'US', 'Won', 'Lost']);

    await screen.findAllByRole('button', { name: 'Select Sankey curve' });

    expect(container.querySelector(`rect[fill="${nodeColor(hueMap.Search ?? 0)}"]`)).not.toBeNull();
    expect(container.querySelector(`stop[stop-color="${nodeColor(hueMap.Search ?? 0)}"]`)).not.toBeNull();
    expect(container.querySelector(`stop[stop-color="${nodeColorVivid(hueMap.EU ?? 0)}"]`)).not.toBeNull();
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
    const searchLabel = screen.getByText('Search');

    fireEvent.mouseEnter(searchLabel);

    expect(curves[0]?.getAttribute('fill-opacity')).toBe('0.75');
    expect(curves[1]?.getAttribute('fill-opacity')).toBe('0.75');
    expect(curves[2]?.getAttribute('fill-opacity')).toBe('0.32');
  });

  it('shows an empty state when fewer than two columns are enabled', () => {
    render(<Example />);

    fireEvent.click(getColumnCheckbox('Region'));
    fireEvent.click(getColumnCheckbox('Outcome'));

    expect(screen.getByText('Select at least two columns with data to display a flow')).toBeDefined();
  });

  it('keeps excluded columns available to enable again', async () => {
    render(<Example />);
    const regionCheckbox = getColumnCheckbox('Region');

    fireEvent.click(regionCheckbox);
    await waitFor(() => expect(getColumnCheckbox('Region').getAttribute('data-checked')).toBeNull());
    fireEvent.click(getColumnCheckbox('Region'));
    await waitFor(() => expect(getColumnCheckbox('Region').getAttribute('data-checked')).not.toBeNull());
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

  it('renders drag handles and recomputes the flow for a controlled column order', async () => {
    const onCurveClick = vi.fn();
    render(<Example onCurveClick={onCurveClick} columnOrder={['region', 'channel', 'outcome']} />);

    expect(screen.getAllByRole('button', { name: /^Reorder / })[0].getAttribute('aria-label')).toBe('Reorder Region');
    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    fireEvent.click(curves[0]);

    expect(onCurveClick).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({ column: { id: 'region', label: 'Region' } }),
        target: expect.objectContaining({ column: { id: 'channel', label: 'Channel' } }),
      }),
    );
  });
});
