// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExperimentResultPanel } from '../experiment-result-panel';
import { expectComputedTag, expectInheritsTagForeground } from '@/test/computed-tag';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { makeWrapper } from '@/test/render';

const makeResult = (overrides: Partial<DatasetExperimentResult> = {}): DatasetExperimentResult => ({
  id: 'res-1',
  experimentId: 'exp-1',
  itemId: 'item-1',
  input: 'hello',
  output: 'world',
  groundTruth: null,
  scores: {},
  error: null,
  status: null,
  tags: null,
  comment: null,
  traceId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

// The panel prefetches trace feedback for the needs-review dot.
beforeEach(() => {
  server.use(
    http.get('*/api/observability/feedback', () =>
      HttpResponse.json({ feedback: [], pagination: { total: 0, page: 0, perPage: 50, hasMore: false } }),
    ),
  );
});

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => cleanup());

function selectOption(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

function renderPanel(
  result: DatasetExperimentResult,
  props: Partial<Parameters<typeof ExperimentResultPanel>[0]> = {},
) {
  const onTagsChange = vi.fn();
  const { wrapper: Wrapper } = makeWrapper();
  render(
    <Wrapper>
      <TestLinkProvider>
        <ExperimentResultPanel
          result={result}
          onClose={() => {}}
          onTagsChange={onTagsChange}
          tagVocabulary={['alpha', 'beta']}
          {...props}
        />
      </TestLinkProvider>
    </Wrapper>,
  );
  return { onTagsChange };
}

describe('ExperimentResultPanel metadata', () => {
  describe('given a result with a status and tags', () => {
    const result = makeResult({ status: 'needs-review', tags: ['alpha'] });

    it('shows the status and the tags as metadata rows instead of a "Review" section', () => {
      renderPanel(result);

      expect(screen.queryByText('Review')).toBeNull();
      expect(screen.getByText('Status')).toBeDefined();
      expect(screen.getByText('needs-review')).toBeDefined();
      expect(screen.getByText('Tags')).toBeDefined();
      expect(screen.getByText('alpha')).toBeDefined();
    });

    it('removes a tag from the badge', () => {
      const { onTagsChange } = renderPanel(result);

      fireEvent.click(screen.getByRole('button', { name: 'Remove tag alpha' }));

      expect(onTagsChange).toHaveBeenCalledWith([]);
    });

    it('renders the remove action in the tag foreground color with a pointer cursor', () => {
      renderPanel(result);

      expectInheritsTagForeground(screen.getByRole('button', { name: 'Remove tag alpha' }));
    });

    it('adds an existing tag from the picker', async () => {
      const { onTagsChange } = renderPanel(result);

      fireEvent.click(screen.getByRole('combobox'));
      selectOption(await screen.findByRole('option', { name: 'beta' }));

      expect(onTagsChange).toHaveBeenCalledWith(['alpha', 'beta']);
    });

    it('creates a new tag from the picker', async () => {
      const { onTagsChange } = renderPanel(result);

      fireEvent.click(screen.getByRole('combobox'));
      const search = await screen.findByPlaceholderText('Search or create tag...');
      fireEvent.input(search, { target: { value: 'fresh' }, inputType: 'insertText' });
      selectOption(await screen.findByRole('option', { name: 'Create "fresh"' }));

      expect(onTagsChange).toHaveBeenCalledWith(['alpha', 'fresh']);
    });
  });

  describe('given a result without status or tags', () => {
    it('hides the status row but still offers the tag picker', () => {
      renderPanel(makeResult());

      expect(screen.queryByText('Status')).toBeNull();
      expect(screen.getByText('Tags')).toBeDefined();
      expect(screen.getByRole('combobox').textContent).toContain('Add tag');
    });
  });

  describe('given no onTagsChange handler', () => {
    it('renders tags read-only without picker or remove buttons', () => {
      renderPanel(makeResult({ tags: ['alpha'] }), { onTagsChange: undefined });

      expect(screen.getByText('alpha')).toBeDefined();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove tag alpha' })).toBeNull();
    });

    it('renders each tag with colors computed from its value', () => {
      renderPanel(makeResult({ tags: ['alpha'] }), { onTagsChange: undefined });

      expectComputedTag(screen.getByText('alpha'), 'alpha');
    });
  });
});

describe('ExperimentResultPanel review controls', () => {
  it('renders a "See experiment" link when experimentLink is provided', () => {
    renderPanel(makeResult(), { experimentLink: '/experiments/exp-1' });

    expect(screen.getByRole('link', { name: /See experiment/ }).getAttribute('href')).toBe('/experiments/exp-1');
  });

  it('splits into Details and Feedback tabs when feedbackTabSlot is provided and the result has a trace', () => {
    const feedbackTabSlot = vi.fn(({ traceId }: { traceId: string }) => <div>feedback for {traceId}</div>);
    renderPanel(makeResult({ traceId: 'trace-1' }), { feedbackTabSlot });

    expect(screen.getByText('Item Id')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
    expect(screen.getByText('feedback for trace-1')).toBeDefined();
  });

  it('renders no tabs without a trace id even when feedbackTabSlot is provided', () => {
    renderPanel(makeResult({ traceId: null }), { feedbackTabSlot: () => <div>feedback</div> });

    expect(screen.queryByRole('tab', { name: 'Feedback' })).toBeNull();
    expect(screen.getByText('Item Id')).toBeDefined();
  });

  it('renders the complete action for needs-review results when onComplete is provided', () => {
    const onComplete = vi.fn();
    renderPanel(makeResult({ status: 'needs-review' }), { onComplete });

    fireEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
    expect(onComplete).toHaveBeenCalled();
  });

  it('hides the complete action when the result does not need review', () => {
    renderPanel(makeResult({ status: null }), { onComplete: vi.fn() });

    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull();
  });
});
