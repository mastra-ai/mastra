// @vitest-environment jsdom
import type { ListFeedbackResponse } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceAnnotationComposer, TraceAnnotationList } from '../trace-annotations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const withProviders = (children: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

describe('TraceAnnotationComposer', () => {
  describe('when the reviewer saves a note on a highlighted quote', () => {
    it('posts an attributed annotation with the quote', async () => {
      const onFeedback = vi.fn<(body: unknown) => void>();
      const onDone = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/observability/feedback`, async ({ request }) => {
          onFeedback(await request.json());
          return HttpResponse.json({ success: true });
        }),
      );

      withProviders(
        <TraceAnnotationComposer
          traceId="trace-a"
          spanId="span-a"
          selection={{ target: 'response', quote: 'Acute aortic dissection' }}
          onDone={onDone}
        />,
      );

      fireEvent.change(screen.getByLabelText('Annotation'), {
        target: { value: 'Should mention blood pressure control first.' },
      });
      fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dr. Reyes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save annotation' }));

      await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(1));
      expect(onFeedback).toHaveBeenCalledWith({
        feedback: {
          traceId: 'trace-a',
          spanId: 'span-a',
          feedbackSource: 'studio',
          feedbackType: 'annotation',
          value: 'Acute aortic dissection',
          comment: 'Should mention blood pressure control first.',
          feedbackUserId: 'Dr. Reyes',
          metadata: { reviewTarget: 'response', quote: 'Acute aortic dissection' },
        },
      });
      expect(onDone).toHaveBeenCalled();
      expect(window.localStorage.getItem('mastra:studio:reviewer-name')).toBe('Dr. Reyes');
    });
  });

  describe('when the note is empty', () => {
    it('keeps the save button disabled', () => {
      withProviders(
        <TraceAnnotationComposer traceId="trace-a" selection={{ target: 'case', quote: 'fever' }} onDone={vi.fn()} />,
      );

      expect(screen.getByRole('button', { name: 'Save annotation' }).hasAttribute('disabled')).toBe(true);
    });
  });
});

describe('TraceAnnotationList', () => {
  const feedbackData: ListFeedbackResponse = {
    feedback: [
      {
        feedbackId: 'fb-1',
        timestamp: new Date('2026-08-21T16:00:00.000Z'),
        traceId: 'trace-a',
        feedbackType: 'annotation',
        value: 'Acute aortic dissection',
        comment: 'Confidence is overstated.',
        feedbackUserId: 'Dr. Reyes',
        metadata: { reviewTarget: 'response', quote: 'Acute aortic dissection' },
      },
      {
        feedbackId: 'fb-2',
        timestamp: new Date('2026-08-21T16:05:00.000Z'),
        traceId: 'trace-a',
        feedbackType: 'review',
        value: 1,
      },
    ],
    pagination: { total: 2, page: 0, perPage: 10, hasMore: false },
  };

  describe('when annotations exist for the section', () => {
    it('shows the quote, note, and author', () => {
      withProviders(<TraceAnnotationList feedbackData={feedbackData} target="response" />);

      expect(screen.getByText('“Acute aortic dissection”')).not.toBeNull();
      expect(screen.getByText('Confidence is overstated.')).not.toBeNull();
      expect(screen.getByText('Dr. Reyes')).not.toBeNull();
    });
  });

  describe('when no annotations match the section', () => {
    it('renders nothing', () => {
      const { container } = withProviders(<TraceAnnotationList feedbackData={feedbackData} target="case" />);

      expect(container.textContent).toBe('');
    });
  });
});
