// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SpanDataPanelView } from '../span-data-panel-view';
import type { SpanDataPanelViewProps } from '../span-data-panel-view';
import { spanFixture } from './fixtures/span-data-panel-view';

const baseProps: SpanDataPanelViewProps = {
  traceId: 'trace-1',
  spanId: 'span-1',
  span: spanFixture,
  onClose: vi.fn(),
};

afterEach(cleanup);

describe('SpanDataPanelView — header summary', () => {
  it('shows started, ended and duration in the header, not in the details list', () => {
    render(<SpanDataPanelView {...baseProps} />);

    expect(screen.getByLabelText(/^Started at/)).toBeTruthy();
    expect(screen.getByLabelText(/^Ended at/)).toBeTruthy();
    // Same `X.XXX s` format as the timeline timing column.
    expect(screen.getByLabelText(/^Duration/).textContent).toBe('1.000 s');
    expect(screen.queryByText('Started')).toBeNull();
    expect(screen.queryByText('Ended')).toBeNull();
    expect(screen.queryByText('Duration')).toBeNull();
  });

  it('drops Name, Type, Trace Id, Thread Id and Resource Id from the details list', () => {
    render(
      <SpanDataPanelView {...baseProps} span={{ ...spanFixture, threadId: 'thread-1', resourceId: 'resource-1' }} />,
    );

    for (const label of ['Name', 'Type', 'Trace Id', 'Thread Id', 'Resource Id']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('shows the run id truncated to 8 characters in the header', () => {
    render(<SpanDataPanelView {...baseProps} span={{ ...spanFixture, runId: 'run-abcdefghijklmnop' }} />);

    const runId = screen.getByLabelText('Run Id run-abcdefghijklmnop');
    expect(runId.textContent).toContain('run-abcd');
    expect(runId.textContent).not.toContain('run-abcdefghijklmnop');
    expect(screen.queryByText('Run Id')).toBeNull();
  });
});

describe('SpanDataPanelView — tabs', () => {
  it('renders the tab list with the pill-ghost variant, like the agent page tabs', () => {
    const { container } = render(<SpanDataPanelView {...baseProps} feedbackTabSlot={() => <div>feedback</div>} />);

    expect(container.querySelector('[data-variant="pill-ghost"]')).not.toBeNull();
  });

  it('renders Details and Feedback tabs, with Details active by default', () => {
    render(<SpanDataPanelView {...baseProps} feedbackTabSlot={() => <div>feedback here</div>} />);

    expect(screen.getByRole('tab', { name: /details/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /feedback/i })).toBeTruthy();
    expect(screen.queryByText('feedback here')).toBeNull();
  });

  it('renders no tabs when no feedback slot is provided', () => {
    render(<SpanDataPanelView {...baseProps} />);

    expect(screen.queryByRole('tab', { name: /details/i })).toBeNull();
  });
});
