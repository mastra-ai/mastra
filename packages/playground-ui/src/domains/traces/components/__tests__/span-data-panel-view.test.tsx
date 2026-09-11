// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('SpanDataPanelView — span id in the header', () => {
  const fullId = 'span-0123456789abcdef';

  it('shows the id truncated without a # prefix', () => {
    render(<SpanDataPanelView {...baseProps} spanId={fullId} />);

    const heading = screen.getByRole('heading', { name: /^Span span-0123456…/ });
    expect(heading.textContent).not.toContain('#');
    expect(screen.queryByText(fullId)).toBeNull();
  });

  it('shows the copy action instead of the full id in a tooltip', async () => {
    render(<SpanDataPanelView {...baseProps} spanId={fullId} />);

    fireEvent.focus(screen.getByRole('button', { name: 'span-0123456…' }));

    expect((await screen.findByRole('tooltip')).textContent).toBe('Copy to clipboard');
    expect(screen.queryByText(fullId)).toBeNull();
  });

  it('copies the full id on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SpanDataPanelView {...baseProps} spanId={fullId} />);

    const button = screen.getByRole('button', { name: 'span-0123456…' });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith(fullId);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Copied to clipboard');
    expect(button.textContent).toBe('span-0123456…');
    expect(button.querySelector('svg')).toBeNull();
  });

  it('copies a short id by clicking the id itself', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SpanDataPanelView {...baseProps} spanId="span-1" />);

    expect(screen.getByRole('heading', { name: /^Span span-1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'span-1' }));
    expect(writeText).toHaveBeenCalledWith('span-1');
    expect((await screen.findByRole('tooltip')).textContent).toBe('Copied to clipboard');
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
