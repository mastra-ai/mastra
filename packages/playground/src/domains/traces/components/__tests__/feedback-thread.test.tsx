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
      traceId: 'trace-1',
      feedbackType: 'comment',
      feedbackSource: 'user',
      value: 'this span looks wrong',
      timestamp: new Date('2026-08-26T09:00:00Z'),
    },
  ],
  pagination: { page: 0, perPage: 10, total: 1, hasMore: false },
} as unknown as ListFeedbackResponse;

describe('FeedbackThread', () => {
  it('renders existing feedback as comments', () => {
    render(<FeedbackThread feedbackData={feedbackData} onSubmit={vi.fn()} />);

    expect(screen.getByText('this span looks wrong')).toBeTruthy();
    expect(screen.queryByText('user')).toBeNull();
  });

  it('shows an empty state when there is no feedback', () => {
    render(<FeedbackThread onSubmit={vi.fn()} />);

    expect(screen.getByText('No feedback yet')).toBeTruthy();
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
