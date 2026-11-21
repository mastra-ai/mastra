// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExperimentResultPanel } from '../experiment-result-panel';
import { agentTraceUsage } from './fixtures/experiment-item-usage';
import {
  agentFailedResult,
  agentMarkdownResult,
  agentNoFinalTextResult,
  agentToolCallsResult,
  workflowResult,
} from './fixtures/experiment-results';
import { expectComputedTag, expectInheritsTagForeground } from '@/test/computed-tag';
import { TestLinkProvider } from '@/test/link-provider';

const makeResult = (overrides: Partial<DatasetExperimentResult> = {}): DatasetExperimentResult => ({
  id: 'res-1',
  experimentId: 'exp-1',
  itemId: 'item-1',
  input: 'hello',
  targetType: 'workflow',
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
  const tree = (current: DatasetExperimentResult) => (
    <TestLinkProvider>
      <ExperimentResultPanel
        open
        result={current}
        onClose={() => {}}
        onTagsChange={onTagsChange}
        tagVocabulary={['alpha', 'beta']}
        {...props}
      />
    </TestLinkProvider>
  );
  const { rerender } = render(tree(result));
  return { onTagsChange, showResult: (next: DatasetExperimentResult) => rerender(tree(next)) };
}

describe('ExperimentResultPanel output', () => {
  describe('when the result is an agent result with text', () => {
    it('renders the output text as markdown', () => {
      renderPanel(agentMarkdownResult);

      expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined();
      expect(screen.getByText('bold').tagName).toBe('STRONG');
    });

    it('does not render the raw markdown source', () => {
      renderPanel(agentMarkdownResult);

      expect(document.body.textContent).not.toContain('**bold**');
    });
  });

  describe('when the result is a workflow result', () => {
    it('renders the output as JSON', () => {
      renderPanel(workflowResult);

      expect(document.body.textContent).toContain('"answer": 42');
    });
  });

  describe('when the agent called tools', () => {
    it('lists each tool call with its result', () => {
      renderPanel(agentToolCallsResult);

      const toolCalls = screen.getByRole('region', { name: /^Tool calls/ });
      fireEvent.click(within(toolCalls).getByRole('button', { name: /SearchDocs/ }));

      expect(toolCalls.textContent).toContain('"hits": 3');
    });
  });

  describe('when the agent called tools but produced no final text', () => {
    it('explains the missing text instead of dumping the raw output', () => {
      renderPanel(agentNoFinalTextResult);

      const output = screen.getByRole('region', { name: 'Output' });
      expect(within(output).getByText('No final text response after 2 tool calls')).toBeTruthy();
      expect(output.textContent).not.toContain('toolCalls');
    });
  });
});

describe('ExperimentResultPanel metadata', () => {
  describe('given a result with a status and tags', () => {
    const result = makeResult({ status: 'needs-review', tags: ['alpha'] });

    it('shows the status and the tags as metadata rows', () => {
      renderPanel(result);

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
      const search = await screen.findByPlaceholderText('Search or create tag');
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

  it('renders the complete action with a visible label, before the other header actions', () => {
    renderPanel(makeResult({ status: 'needs-review' }), {
      onComplete: vi.fn(),
      experimentLink: '/experiments/exp-1',
    });

    const button = screen.getByRole('button', { name: 'Mark as reviewed' });
    expect(button.textContent).toBe('Mark as reviewed');
    const experimentLink = screen.getByRole('link', { name: /See experiment/ });
    expect(button.compareDocumentPosition(experimentLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Sits on the left of the header, outside the right-aligned actions group.
    expect(experimentLink.parentElement?.contains(button)).toBe(false);
  });

  it('renders the request review action with a visible label', () => {
    const onFlagForReview = vi.fn();
    renderPanel(makeResult({ status: null }), { onFlagForReview });

    const button = screen.getByRole('button', { name: 'Request review' });
    expect(button.textContent).toBe('Request review');
    fireEvent.click(button);
    expect(onFlagForReview).toHaveBeenCalled();
  });
});

describe('ExperimentResultPanel trace usage', () => {
  describe('when there is no usage', () => {
    it('renders no usage rows', () => {
      renderPanel(makeResult({ targetType: 'agent', traceId: 'trace-a' }));

      expect(screen.queryByText('Tokens')).toBeNull();
      expect(screen.queryByText('Cost')).toBeNull();
    });
  });

  describe('when the trace has usage', () => {
    it('shows total tokens and cost', () => {
      renderPanel(makeResult({ targetType: 'agent', traceId: 'trace-a' }), { usage: agentTraceUsage });

      expect(screen.getByText('Tokens')).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
      expect(screen.getByText('$0.001')).toBeDefined();
    });
  });

  describe('when the usage of an agent result is still loading', () => {
    it('reserves the cost and tokens rows', () => {
      renderPanel(makeResult({ targetType: 'agent', traceId: 'trace-a' }), { isUsageLoading: true });

      expect(termLabels().slice(0, 2)).toEqual(['Cost', 'Tokens']);
    });
  });

  describe('when the usage of a workflow result is still loading', () => {
    it('does not reserve usage rows', () => {
      renderPanel(makeResult({ targetType: 'workflow', traceId: 'trace-a' }), { isUsageLoading: true });

      expect(termLabels()).not.toContain('Cost');
    });
  });
});

describe('ExperimentResultPanel feedback tab', () => {
  describe('when the feedback count is known', () => {
    it('shows it on the tab', () => {
      renderPanel(makeResult({ traceId: 'trace-1' }), {
        feedbackTabSlot: () => <div>feedback</div>,
        feedbackCount: 3,
      });

      expect(screen.getByRole('tab', { name: 'Feedback (3)' })).toBeDefined();
    });
  });
});

const termLabels = () => screen.getAllByRole('term').map(term => term.textContent);
const regionNames = () => screen.getAllByRole('region').map(region => region.getAttribute('aria-label'));

describe('ExperimentResultPanel summary', () => {
  describe('when the result has run timestamps', () => {
    it('shows the run duration', () => {
      renderPanel(
        makeResult({
          startedAt: new Date('2026-01-01T00:00:00Z'),
          completedAt: new Date('2026-01-01T00:00:01Z'),
        }),
      );

      expect(termLabels()).toContain('Duration');
    });
  });

  describe('when the result has usage, details and scores', () => {
    it('lists usage first, then item details, then scorers', () => {
      renderPanel(
        makeResult({
          traceId: 'trace-a',
          status: 'needs-review',
          startedAt: new Date('2026-01-01T00:00:00Z'),
          completedAt: new Date('2026-01-01T00:00:01Z'),
        }),
        { scores: [{ id: 'score-1', scorerId: 'accuracy', score: 0.5 }], usage: agentTraceUsage },
      );

      expect(termLabels()).toEqual(['Cost', 'Duration', 'Tokens', 'Item Id', 'Created', 'Status', 'Tags', 'accuracy']);
    });
  });

  describe('when scores can be opened', () => {
    const scores = [
      { id: 'score-1', scorerId: 'accuracy', score: 0.5 },
      { id: 'score-2', scorerId: 'tone', score: 1 },
    ];

    it('opens the clicked score', () => {
      const onScoreClick = vi.fn();
      renderPanel(makeResult(), { scores, onScoreClick });

      fireEvent.click(screen.getByRole('button', { name: 'tone' }));

      expect(onScoreClick).toHaveBeenCalledWith('score-2');
    });

    it('marks the featured score as pressed', () => {
      renderPanel(makeResult(), { scores, onScoreClick: vi.fn(), featuredScoreId: 'score-1' });

      expect(screen.getByRole('button', { name: 'accuracy' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'tone' }).getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('when scores cannot be opened', () => {
    it('links each scorer to its page', () => {
      renderPanel(makeResult(), { scores: [{ id: 'score-1', scorerId: 'accuracy', score: 0.5 }] });

      expect(screen.getByRole('link', { name: 'Open accuracy' }).getAttribute('href')).toBe('/scorers/accuracy');
    });
  });
});

describe('ExperimentResultPanel score reason', () => {
  describe('when a score has a reason', () => {
    const scores = [{ id: 'score-1', scorerId: 'accuracy', score: 0.5, reason: 'Because **bold**' }];

    it('shows an info button next to the score', () => {
      renderPanel(makeResult(), { scores });

      expect(screen.getByRole('button', { name: 'Show accuracy reason' })).toBeDefined();
    });

    it('renders the reason as markdown when the info button is focused', async () => {
      renderPanel(makeResult(), { scores });

      fireEvent.focus(screen.getByRole('button', { name: 'Show accuracy reason' }));

      expect((await screen.findByText('bold')).tagName).toBe('STRONG');
    });
  });

  describe('when a score has no reason', () => {
    it('does not show an info button', () => {
      renderPanel(makeResult(), { scores: [{ id: 'score-1', scorerId: 'accuracy', score: 0.5, reason: null }] });

      expect(screen.queryByRole('button', { name: 'Show accuracy reason' })).toBeNull();
    });
  });
});

describe('ExperimentResultPanel payloads', () => {
  describe('when the result has a ground truth', () => {
    it('shows Input, Ground Truth, then Output', () => {
      renderPanel(makeResult({ groundTruth: 'expected' }));

      expect(regionNames()).toEqual(['Input', 'Ground Truth', 'Output']);
    });
  });

  describe('when the result has no ground truth', () => {
    it('hides the Ground Truth section', () => {
      renderPanel(makeResult({ groundTruth: null }));

      expect(regionNames()).toEqual(['Input', 'Output']);
    });
  });

  describe('when the result failed', () => {
    it('shows the error in place of the output', () => {
      renderPanel(agentFailedResult);

      expect(regionNames()).toEqual(['Input', 'Error']);
      expect(screen.getByRole('region', { name: 'Error' }).textContent).toContain('model exploded');
    });
  });
});

describe('ExperimentResultPanel inline variant', () => {
  describe('when variant is inline and a result is given', () => {
    it('renders the result as an inline section in the document flow', () => {
      renderPanel(agentMarkdownResult, { variant: 'inline' });

      const panel = document.querySelector('[data-slot="data-panel"]');
      expect(panel?.tagName).toBe('SECTION');
      expect(panel?.getAttribute('data-variant')).toBe('inline');
    });

    it('does not render a modal dialog', () => {
      renderPanel(agentMarkdownResult, { variant: 'inline' });

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when variant is inline and neither a result nor an item id is given', () => {
    it('renders nothing', () => {
      renderPanel(agentMarkdownResult, { variant: 'inline', result: undefined });

      expect(document.querySelector('[data-slot="data-panel"]')).toBeNull();
    });
  });
});
