// @vitest-environment jsdom
import type { FeedbackRecord } from '@mastra/core/storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnnotatedMarkdown } from '../annotated-markdown';

afterEach(cleanup);

const annotation: FeedbackRecord = {
  feedbackId: 'fb-1',
  timestamp: new Date('2026-08-21T11:00:00.000Z'),
  traceId: 'trace-1',
  feedbackType: 'annotation',
  value: 'surgical evaluation',
  comment: 'Specify the timeframe for surgery consult.',
  feedbackUserId: 'Dr. Reyes',
  metadata: { reviewTarget: 'response', quote: 'surgical evaluation' },
};

describe('AnnotatedMarkdown', () => {
  describe('when an annotation quote matches the text', () => {
    it('highlights the quote inline', async () => {
      const { container } = render(
        <AnnotatedMarkdown annotations={[annotation]}>Same-day surgical evaluation is warranted.</AnnotatedMarkdown>,
      );

      await waitFor(() => {
        const mark = container.querySelector('mark[data-annotation-key="fb-1"]');
        expect(mark?.textContent).toBe('surgical evaluation');
      });
    });

    it('opens the comment with author when the highlight is clicked', async () => {
      const { container } = render(
        <AnnotatedMarkdown annotations={[annotation]}>Same-day surgical evaluation is warranted.</AnnotatedMarkdown>,
      );

      await waitFor(() => expect(container.querySelector('mark[data-annotation-key]')).not.toBeNull());
      fireEvent.click(container.querySelector('mark[data-annotation-key]')!);

      expect(screen.getByRole('dialog', { name: 'Annotation' })).not.toBeNull();
      expect(screen.getByText('Specify the timeframe for surgery consult.')).not.toBeNull();
      expect(screen.getByText('Dr. Reyes')).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Close annotation' }));
      expect(screen.queryByRole('dialog', { name: 'Annotation' })).toBeNull();
    });
  });

  describe('when no annotation matches', () => {
    it('renders the markdown without highlights', () => {
      const { container } = render(<AnnotatedMarkdown annotations={[]}>Plain response text.</AnnotatedMarkdown>);

      expect(container.querySelector('mark')).toBeNull();
      expect(screen.getByText('Plain response text.')).not.toBeNull();
    });
  });
});
