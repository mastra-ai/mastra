// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ExperimentResultsTagPicker } from '../experiment-results-tag-picker';

const makeResult = (id: string, tags: string[] | null): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
  itemId: `item-${id}`,
  input: {},
  output: {},
  groundTruth: null,
  scores: {},
  error: null,
  status: null,
  tags,
  comment: null,
  traceId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => cleanup());

async function openCombobox() {
  const trigger = await screen.findByRole('combobox');
  expect(trigger.textContent).toContain('Add tag');
  fireEvent.click(trigger);
  return screen.findByPlaceholderText('Search or create tag...');
}

function selectOption(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

function renderPicker(selectedResults: DatasetExperimentResult[], onAddTag = vi.fn()) {
  render(
    <ExperimentResultsTagPicker selectedResults={selectedResults} vocabulary={['beta', 'alpha']} onAddTag={onAddTag} />,
  );
  return onAddTag;
}

describe('ExperimentResultsTagPicker', () => {
  describe('given a vocabulary of "alpha" and "beta" and two selected results both tagged "alpha"', () => {
    const selected = [makeResult('res-1', ['alpha']), makeResult('res-2', ['alpha', 'x'])];

    it('lists the vocabulary sorted and marks tags applied to every selected result', async () => {
      renderPicker(selected);
      await openCombobox();

      await screen.findByRole('option', { name: 'beta' });
      const options = screen.getAllByRole('option');
      expect(options.map(o => o.textContent)).toEqual(['alpha', 'beta']);
      expect(within(options[0]).queryByTestId('tag-applied')).not.toBeNull();
      expect(within(options[1]).queryByTestId('tag-applied')).toBeNull();
    });

    it('calls onAddTag when an unapplied tag is selected', async () => {
      const onAddTag = renderPicker(selected);
      await openCombobox();

      selectOption(await screen.findByRole('option', { name: 'beta' }));

      expect(onAddTag).toHaveBeenCalledWith('beta');
    });

    it('does nothing when a tag already applied to every selected result is selected', async () => {
      const onAddTag = renderPicker(selected);
      await openCombobox();

      selectOption(await screen.findByRole('option', { name: 'alpha' }));

      await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it('offers to create an unknown tag as the first option and calls onAddTag with it', async () => {
      const onAddTag = renderPicker(selected);
      const search = await openCombobox();

      fireEvent.input(search, { target: { value: 'new-tag' }, inputType: 'insertText' });
      const create = await screen.findByRole('option', { name: 'Create "new-tag"' });
      expect(screen.getAllByRole('option')[0]).toBe(create);

      selectOption(create);

      expect(onAddTag).toHaveBeenCalledWith('new-tag');
    });

    it('does not offer to create a tag that already exists in the vocabulary', async () => {
      renderPicker(selected);
      const search = await openCombobox();

      fireEvent.input(search, { target: { value: 'beta' }, inputType: 'insertText' });

      await screen.findByRole('option', { name: 'beta' });
      expect(screen.queryByRole('option', { name: /^Create/ })).toBeNull();
    });
  });

  describe('given only one of two selected results is tagged "alpha"', () => {
    it('does not mark "alpha" as applied', async () => {
      renderPicker([makeResult('res-1', ['alpha']), makeResult('res-2', null)]);
      await openCombobox();

      const alpha = await screen.findByRole('option', { name: 'alpha' });
      expect(within(alpha).queryByTestId('tag-applied')).toBeNull();
    });
  });
});
