// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ExperimentResultPanel } from '../experiment-result-panel';
import { expectComputedTag, expectInheritsTagForeground } from '@/test/computed-tag';

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
  render(
    <ExperimentResultPanel
      result={result}
      onClose={() => {}}
      onTagsChange={onTagsChange}
      tagVocabulary={['alpha', 'beta']}
      {...props}
    />,
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

    it('renders the remove action in the tag foreground color', () => {
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
      render(<ExperimentResultPanel result={makeResult({ tags: ['alpha'] })} onClose={() => {}} />);

      expect(screen.getByText('alpha')).toBeDefined();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove tag alpha' })).toBeNull();
    });

    it('renders each tag with colors computed from its value', () => {
      render(<ExperimentResultPanel result={makeResult({ tags: ['alpha'] })} onClose={() => {}} />);

      expectComputedTag(screen.getByText('alpha'), 'alpha');
    });
  });
});
