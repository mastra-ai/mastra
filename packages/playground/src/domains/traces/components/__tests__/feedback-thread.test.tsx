// @vitest-environment jsdom
import type { ListFeedbackResponse } from '@mastra/core/storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedbackThread } from '../feedback-thread';

afterEach(() => cleanup());

const getInput = () => screen.getByPlaceholderText('Leave feedback...') as HTMLInputElement;
const getSubmit = () => screen.getByRole('button', { name: 'Send feedback' }) as HTMLButtonElement;
const type = (value: string) => fireEvent.change(getInput(), { target: { value } });

const feedbackData = {
  feedback: [
    {
      feedbackId: 'fb-1',
      traceId: 'trace-1',
      feedbackType: 'comment',
      feedbackSource: 'user',
      value: 'this span looks wrong',
      timestamp: new Date('2026-08-26T09:00:00Z'),
      reviewStatus: 'needs-review',
    },
  ],
  pagination: { page: 0, perPage: 10, total: 1, hasMore: false },
} as unknown as ListFeedbackResponse;

const withAuthor = (author: { id: string; name?: string; email?: string; avatarUrl?: string }) =>
  ({ ...feedbackData, feedback: [{ ...feedbackData.feedback[0], author }] }) as unknown as ListFeedbackResponse;

const withReviewStatus = (reviewStatus: 'needs-review' | 'reviewed') =>
  ({ ...feedbackData, feedback: [{ ...feedbackData.feedback[0], reviewStatus }] }) as unknown as ListFeedbackResponse;

describe('FeedbackThread', () => {
  it('renders existing feedback as comments', () => {
    render(<FeedbackThread feedbackData={feedbackData} onSubmit={vi.fn()} />);

    expect(screen.getByText('this span looks wrong')).toBeTruthy();
    expect(screen.queryByText('user')).toBeNull();
    expect(document.querySelector('[data-slot="comment-item-author"]')).toBeNull();
    // No author means no avatar gutter, otherwise the row is indented by an empty 24px column.
    expect(document.querySelector('[data-slot="comment-item-avatar"]')).toBeNull();
  });

  it('renders the author avatar and name when the feedback has an author', () => {
    render(
      <FeedbackThread
        feedbackData={withAuthor({ id: 'u1', name: 'Marvin Frachet', avatarUrl: 'https://example.com/a.png' })}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Marvin Frachet').getAttribute('data-slot')).toBe('comment-item-author');
    const img = screen.getByAltText('Marvin Frachet') as HTMLImageElement;
    expect(img.closest('[data-slot="comment-item-avatar"]')).toBeTruthy();
    expect(img.src).toBe('https://example.com/a.png');
  });

  it('puts the avatar inline in the header for the embed variant', () => {
    render(
      <FeedbackThread
        variant="embed"
        feedbackData={withAuthor({ id: 'u1', name: 'Marvin Frachet', avatarUrl: 'https://example.com/a.png' })}
        onSubmit={vi.fn()}
      />,
    );

    const img = screen.getByAltText('Marvin Frachet');
    expect(img.closest('[data-slot="comment-item-header"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="comment-item-avatar"]')).toBeNull();
  });

  it('falls back to email, then id, when the author has no name', () => {
    const { rerender } = render(
      <FeedbackThread feedbackData={withAuthor({ id: 'u1', email: 'm@x.io' })} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('m@x.io').getAttribute('data-slot')).toBe('comment-item-author');

    rerender(<FeedbackThread feedbackData={withAuthor({ id: 'u1' })} onSubmit={vi.fn()} />);
    expect(screen.getByText('u1').getAttribute('data-slot')).toBe('comment-item-author');
    // No image: the avatar falls back to the initial.
    expect(document.querySelector('[data-slot="comment-item-avatar"]')?.textContent).toBe('U');
  });

  it('shows an empty state when there is no feedback', () => {
    render(<FeedbackThread onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'No feedback yet' })).toBeTruthy();
    expect(screen.getByText('Leave feedback on this trace to see it here.')).toBeTruthy();
  });

  it('places the composer above the feedback list', () => {
    render(<FeedbackThread feedbackData={withAuthor({ id: 'u1' })} onSubmit={vi.fn()} />);

    const composer = screen.getByRole('form', { name: 'Leave feedback' });
    const item = screen.getByText('u1');
    expect(composer.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables the send button while the input is empty or whitespace-only', () => {
    render(<FeedbackThread onSubmit={vi.fn()} />);

    expect(getSubmit().disabled).toBe(true);
    type('   ');
    expect(getSubmit().disabled).toBe(true);
  });

  it('submits the typed text and clears the input', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackThread onSubmit={onSubmit} />);

    type('looks good');
    fireEvent.click(getSubmit());

    expect(onSubmit).toHaveBeenCalledWith('looks good');
    await waitFor(() => expect(getInput().value).toBe(''));
  });

  it('keeps the draft when submitting fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('nope'));
    render(<FeedbackThread onSubmit={onSubmit} />);

    type('looks good');
    fireEvent.click(getSubmit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(getInput().value).toBe('looks good');
  });

  it('disables the send button while submitting', () => {
    const { rerender } = render(<FeedbackThread onSubmit={vi.fn()} />);

    type('hello');
    expect(getSubmit().disabled).toBe(false);

    rerender(<FeedbackThread onSubmit={vi.fn()} isSubmitting />);
    expect(getSubmit().disabled).toBe(true);
  });

  describe('review status', () => {
    it('shows a "Needs review" badge on unreviewed feedback', () => {
      render(<FeedbackThread feedbackData={withReviewStatus('needs-review')} onSubmit={vi.fn()} />);

      expect(screen.getByText('Needs review').closest('[data-slot="feedback-review-status"]')).toBeTruthy();
    });

    it('shows a "Reviewed" badge on reviewed feedback and no action', () => {
      render(
        <FeedbackThread feedbackData={withReviewStatus('reviewed')} onMarkReviewed={vi.fn()} onSubmit={vi.fn()} />,
      );

      expect(screen.getByText('Reviewed')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull();
    });

    it('offers "Mark reviewed" on unreviewed feedback and calls onMarkReviewed with the feedbackId', () => {
      const onMarkReviewed = vi.fn();
      render(
        <FeedbackThread
          feedbackData={withReviewStatus('needs-review')}
          onMarkReviewed={onMarkReviewed}
          onSubmit={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));

      expect(onMarkReviewed).toHaveBeenCalledWith('fb-1');
    });

    it('does not offer "Mark reviewed" when no handler is given', () => {
      render(<FeedbackThread feedbackData={withReviewStatus('needs-review')} onSubmit={vi.fn()} />);

      expect(screen.getByText('Needs review')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull();
    });

    it('disables "Mark reviewed" for the feedback currently being updated', () => {
      render(
        <FeedbackThread
          feedbackData={withReviewStatus('needs-review')}
          onMarkReviewed={vi.fn()}
          pendingFeedbackId="fb-1"
          onSubmit={vi.fn()}
        />,
      );

      expect((screen.getByRole('button', { name: 'Mark reviewed' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('pages through feedback when there is more than one page', () => {
    const onPageChange = vi.fn();
    render(
      <FeedbackThread
        feedbackData={{ ...feedbackData, pagination: { page: 0, perPage: 10, total: 20, hasMore: true } }}
        onPageChange={onPageChange}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
