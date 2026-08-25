import type { ListFeedbackResponse } from '@mastra/core/storage';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpanFeedbackList } from '../span-feedback-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { renderWithProviders } from '@/test/render';

const makeFeedback = (traceId: string, comment: string): ListFeedbackResponse['feedback'][number] => ({
  timestamp: new Date('2026-08-25T10:00:00.000Z'),
  traceId,
  feedbackType: 'thumbs',
  value: 1,
  comment,
  feedbackUserId: 'user-1',
});

const feedbackData: ListFeedbackResponse = {
  feedback: [makeFeedback('t-1', 'first'), makeFeedback('t-2', 'second'), makeFeedback('t-3', 'third')],
  pagination: { total: 3, page: 0, perPage: 10, hasMore: false },
};

const renderList = () => renderWithProviders(<SpanFeedbackList feedbackData={feedbackData} />);

describe('SpanFeedbackList keyboard navigation', () => {
  describe('when the list renders', () => {
    it('applies a roving tabindex across feedback rows', () => {
      renderList();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });
  });

  describe('when navigating with the keyboard', () => {
    it('moves focus with Arrow/Home/End keys', () => {
      renderList();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('when activating a focused row', () => {
    it('opens the feedback dialog for the clicked row', () => {
      renderList();

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowDown' });
      fireEvent.click(rows[1] as HTMLElement);

      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });
});
