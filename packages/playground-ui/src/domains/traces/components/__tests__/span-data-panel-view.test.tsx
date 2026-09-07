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
