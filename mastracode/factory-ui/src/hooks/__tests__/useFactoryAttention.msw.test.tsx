import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { pushableFeedStream } from '../../../e2e/ui/feed-stream';
import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { FeedEventsProvider, useFeedEventsConnected } from '../../ui/domains/factory/context/FeedEventsProvider';
import { ATTENTION_POLL_MS, useFactoryAttentionHistory } from '../useFactoryAttention';

const PROJECT_ID = 'project-1';
/** One fallback tick plus room for the request to land. */
const PAST_ONE_POLL_MS = ATTENTION_POLL_MS + 2_000;

function attentionHandler(counter: { requests: number }) {
  return http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/attention`, () => {
    counter.requests += 1;
    return HttpResponse.json({
      items: [],
      openCount: 0,
      approvalCount: 0,
      badgeCount: 0,
      unreadCount: 0,
      activityUnreadCount: 0,
      hasMore: false,
    });
  });
}

describe('useFactoryAttentionHistory', () => {
  it('does not poll while the feed stream is connected', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    const attention = { requests: 0 };
    server.use(stream.handler, attentionHandler(attention));

    const { result, client } = renderHookWithProviders(
      () => ({
        history: useFactoryAttentionHistory(PROJECT_ID, 'open', ''),
        connected: useFeedEventsConnected(),
      }),
      {
        inner: ({ children }) => <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>,
      },
    );
    await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
    // The interval is gated on connected state, so the quiet window only
    // starts once the stream reports connected.
    await waitFor(() => expect(result.current.connected).toBe(true));
    await waitForMutationsIdle(client);

    const settled = attention.requests;
    await new Promise(resolve => setTimeout(resolve, PAST_ONE_POLL_MS));
    expect(attention.requests).toBe(settled);
  }, 15_000);
});
