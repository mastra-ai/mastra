// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { rootSpanFixture } from './fixtures/trace-data-panel-view';

const baseProps: TraceDataPanelViewProps = {
  traceId: 'trace-1',
  spans: rootSpanFixture,
  onClose: vi.fn(),
  placement: 'traces-list',
};

afterEach(() => cleanup());

describe('TraceDataPanelView — Add tool mocks to item', () => {
  it('fires onAddTraceMocksToItem with the traceId when the button is clicked', () => {
    const onAddTraceMocksToItem = vi.fn();
    render(<TraceDataPanelView {...baseProps} onAddTraceMocksToItem={onAddTraceMocksToItem} />);

    fireEvent.click(screen.getByRole('button', { name: /add tool mocks to item/i }));

    expect(onAddTraceMocksToItem).toHaveBeenCalledTimes(1);
    expect(onAddTraceMocksToItem).toHaveBeenCalledWith({ traceId: 'trace-1' });
  });

  it('does not render the button when the prop is omitted', () => {
    render(<TraceDataPanelView {...baseProps} />);

    expect(screen.queryByRole('button', { name: /add tool mocks to item/i })).toBeNull();
  });
});
