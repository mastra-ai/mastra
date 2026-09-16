import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useFeedbackInboxCount } from '../use-feedback';
import { emptyFeedback } from './fixtures/feedback';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

afterEach(() => vi.useRealTimers());

describe('useFeedbackInboxCount polling', () => {
  describe.each([
    'This storage provider does not support listing feedback',
    'Observability storage domain is not available',
  ])('when the server returns "%s"', error => {
    it('stops polling after the request fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const onRequest = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onRequest();
          return HttpResponse.json({ error }, { status: 500 });
        }),
      );

      const { result, unmount, queryClient } = renderHookWithProviders(() => useFeedbackInboxCount({ enabled: true }));
      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 2000 });
      const requestsAfterFailure = onRequest.mock.calls.length;

      await act(() => vi.advanceTimersByTimeAsync(10_000));

      expect(onRequest).toHaveBeenCalledTimes(requestsAfterFailure);
      unmount();
      queryClient.clear();
    });
  });

  describe('when a transient server error clears', () => {
    it('continues polling and recovers the inbox count', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json({ error: 'Temporarily unavailable' }, { status: 500 })),
      );
      const { result, unmount, queryClient } = renderHookWithProviders(() => useFeedbackInboxCount({ enabled: true }));
      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 2000 });
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(emptyFeedback)));

      await act(() => vi.advanceTimersByTimeAsync(3000));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.pagination?.total).toBe(0);
      unmount();
      queryClient.clear();
    });
  });
});
