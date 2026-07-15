// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stringToColor } from '../../../lib/colors';
import { SankeyChart } from './sankey-chart';

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
  { channel: 'Referral', region: 'US', outcome: 'Won' },
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
  return (
    <SankeyChart data={data} onCurveClick={onCurveClick} columnOrder={columnOrder}>
      <SankeyChart.Column id="channel" label="Channel" />
      <SankeyChart.Column id="region" label="Region" />
      <SankeyChart.Column id="outcome" label="Outcome" />
    </SankeyChart>
  );
}

describe('SankeyChart', () => {
  it('discovers column definitions nested in a fragment', async () => {
    const columns = (
      <>
        <SankeyChart.Column id="channel" label="Channel" />
        <SankeyChart.Column id="region" label="Region" />
        <SankeyChart.Column id="outcome" label="Outcome" />
      </>
    );

    render(<SankeyChart data={data}>{columns}</SankeyChart>);

    expect(await screen.findAllByText('Channel')).not.toHaveLength(0);
    expect(screen.queryByText('Select at least two columns with data to display a flow')).toBeNull();
  });

  it('labels each chart column above its nodes', async () => {
    const { container } = render(<Example />);

    await screen.findByText('Search');
    const chartLabels = [...container.querySelectorAll('svg text')].map(element => element.textContent);

    expect(chartLabels).toEqual(expect.arrayContaining(['Channel', 'Region', 'Outcome']));
    expect(container.querySelectorAll('svg rect[fill="var(--neutral1)"]').length).toBeGreaterThan(0);
  });

  it('colors each curve from its source value', async () => {
    render(<Example onCurveClick={() => {}} />);

    const curves = await screen.findAllByRole('button', { name: 'Select Sankey curve' });
    const colors = curves.map(curve => curve.getAttribute('stroke'));

    expect(colors).toEqual(
      expect.arrayContaining([
        stringToColor('Search', 68, 55),
        stringToColor('Referral', 68, 55),
        stringToColor('EU', 68, 55),
        stringToColor('US', 68, 55),
      ]),
    );
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
