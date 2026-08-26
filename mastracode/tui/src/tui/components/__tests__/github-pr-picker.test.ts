import { describe, expect, it, vi } from 'vitest';

import { GithubPRPickerDialog, githubPRId } from '../github-pr-picker.js';
import type { GithubPRPickerItem } from '../github-pr-picker.js';

function createPicker(input: {
  pullRequests?: GithubPRPickerItem[];
  searchPullRequests?: GithubPRPickerItem[];
  subscribedIds?: Set<string>;
  onConfirm?: (items: GithubPRPickerItem[]) => void;
  onCancel?: () => void;
}) {
  return new GithubPRPickerDialog({
    tui: { requestRender: vi.fn() } as any,
    pullRequests: input.pullRequests ?? [],
    searchPullRequests: input.searchPullRequests,
    subscribedIds: input.subscribedIds,
    onConfirm: input.onConfirm ?? vi.fn(),
    onCancel: input.onCancel ?? vi.fn(),
  });
}

describe('GithubPRPickerDialog', () => {
  it('formats PR ids with or without repository metadata', () => {
    expect(githubPRId({ owner: 'mastra-ai', repo: 'mastra', number: 22407 })).toBe('mastra-ai/mastra#22407');
    expect(githubPRId({ number: 22407 })).toBe('#22407');
  });

  it('filters candidates and clamps the highlighted index', () => {
    const picker = createPicker({
      pullRequests: [
        { owner: 'mastra-ai', repo: 'mastra', number: 1, title: 'first' },
        { owner: 'mastra-ai', repo: 'mastra', number: 2, title: 'second' },
      ],
    }) as any;
    picker.highlightedIndex = 1;

    picker.filterPullRequests('first');

    expect(picker.filteredPullRequests).toEqual([expect.objectContaining({ number: 1 })]);
    expect(picker.highlightedIndex).toBe(0);
  });

  it('toggles selected ids and confirms selected pull requests', () => {
    const onConfirm = vi.fn();
    const picker = createPicker({
      pullRequests: [
        { owner: 'mastra-ai', repo: 'mastra', number: 1 },
        { owner: 'mastra-ai', repo: 'mastra', number: 2 },
      ],
      onConfirm,
    }) as any;

    picker.toggleSelection('mastra-ai/mastra#2');
    picker.confirmSelection();

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ number: 2 })]);
  });

  it('falls back to the highlighted item when nothing is selected', () => {
    const onConfirm = vi.fn();
    const picker = createPicker({
      pullRequests: [
        { owner: 'mastra-ai', repo: 'mastra', number: 1 },
        { owner: 'mastra-ai', repo: 'mastra', number: 2 },
      ],
      onConfirm,
    }) as any;
    picker.highlightedIndex = 0;

    picker.confirmSelection();

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ number: 2 })]);
  });

  it('cancels when confirming with no available item', () => {
    const onCancel = vi.fn();
    const picker = createPicker({ onCancel }) as any;

    picker.confirmSelection();

    expect(onCancel).toHaveBeenCalled();
  });
});
