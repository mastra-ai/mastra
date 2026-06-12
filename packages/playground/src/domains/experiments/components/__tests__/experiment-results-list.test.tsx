// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callFlowResult, failedReplayResult, replayResult } from '../../__tests__/fixtures/tool-replay';
import { ExperimentResultsList } from '../experiment-results-list';

const columns = [
  { name: 'itemId', label: 'Item ID', size: '7rem' },
  { name: 'status', label: 'Status', size: '5rem' },
  { name: 'input', label: 'Input', size: 'minmax(15rem,1fr)' },
];

const results = [replayResult, callFlowResult, failedReplayResult];

describe('ExperimentResultsList featured-row scrolling', () => {
  // jsdom has no scrollIntoView — install a spy like the prod polyfills do.
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(cleanup);

  it('scrolls the featured row into view when the selection comes from outside the list', () => {
    const { rerender } = render(
      <ExperimentResultsList
        results={results}
        isLoading={false}
        featuredResultId={null}
        onResultClick={vi.fn()}
        columns={columns}
      />,
    );

    // Nothing featured — nothing to scroll to.
    expect(scrollIntoView).not.toHaveBeenCalled();

    // The summary flow table features a row that may be far down the list.
    rerender(
      <ExperimentResultsList
        results={results}
        isLoading={false}
        featuredResultId={callFlowResult.id}
        onResultClick={vi.fn()}
        columns={columns}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('re-scrolls when the featured row changes, including selection-mode rows', () => {
    const { rerender } = render(
      <ExperimentResultsList
        results={results}
        isLoading={false}
        featuredResultId={replayResult.id}
        onResultClick={vi.fn()}
        columns={columns}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <ExperimentResultsList
        results={results}
        isLoading={false}
        featuredResultId={failedReplayResult.id}
        onResultClick={vi.fn()}
        columns={columns}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
