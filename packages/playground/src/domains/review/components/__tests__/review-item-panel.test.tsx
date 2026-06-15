// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReviewItem } from '../review-item-card';
import type { ReviewItemPanelProps } from '../review-item-panel';
import { ReviewItemPanel } from '../review-item-panel';

const baseItem: ReviewItem = {
  id: 'item-1',
  input: 'Test input',
  output: 'Test output',
  error: null,
  itemId: 'dataset-item-1',
  tags: [],
};

function renderPanel(overrides: Partial<ReviewItemPanelProps> = {}) {
  const props: ReviewItemPanelProps = {
    item: baseItem,
    tagVocabulary: [],
    onRate: vi.fn(),
    onSetTags: vi.fn(),
    onComment: vi.fn(),
    onRemove: vi.fn(),
    onComplete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ReviewItemPanel {...props} />);
  return props;
}

describe('ReviewItemPanel', () => {
  afterEach(cleanup);

  it('renders the positive and negative rating controls', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Rate positive' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rate negative' })).toBeDefined();
  });

  it('calls onRate with the chosen rating when a control is clicked', () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Rate positive' }));
    expect(props.onRate).toHaveBeenCalledWith('positive');

    fireEvent.click(screen.getByRole('button', { name: 'Rate negative' }));
    expect(props.onRate).toHaveBeenCalledWith('negative');
  });

  it('clears the rating when the already-active control is clicked again', () => {
    const props = renderPanel({ item: { ...baseItem, rating: 'positive' } });

    fireEvent.click(screen.getByRole('button', { name: 'Rate positive' }));
    expect(props.onRate).toHaveBeenCalledWith(undefined);
  });
});
