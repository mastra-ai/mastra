import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import FeedbackPage from '..';
import { emptyFeedbackList, twoFeedbackRecords } from './fixtures/feedback';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const FEEDBACK_ENDPOINT = `${TEST_BASE_URL}/api/observability/feedback`;

const renderPage = (initialEntry = '/feedback') =>
  renderWithProviders(<FeedbackPage />, { router: { initialEntries: [initialEntry] } });

describe('Feedback page', () => {
  it('renders feedback records from the list endpoint', async () => {
    server.use(http.get(FEEDBACK_ENDPOINT, () => HttpResponse.json(twoFeedbackRecords)));

    const { queryClient } = renderPage();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText('Great answer')).not.toBeNull();
    expect(screen.getByText('Solid response overall')).not.toBeNull();
    expect(screen.getByText('thumbs')).not.toBeNull();
    expect(screen.getByText('rating')).not.toBeNull();
  });

  it('renders an empty state when there is no feedback', async () => {
    server.use(http.get(FEEDBACK_ENDPOINT, () => HttpResponse.json(emptyFeedbackList)));

    const { queryClient } = renderPage();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.getByText('No feedback found')).not.toBeNull();
  });

  it('sends URL filters and date range to the list endpoint', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(FEEDBACK_ENDPOINT, ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json(emptyFeedbackList);
      }),
    );

    const { queryClient } = renderPage('/feedback?type=thumbs&source=user&user=user-1');

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(requestedUrls.length).toBeGreaterThan(0);
    const url = new URL(requestedUrls[0]!);
    expect(url.searchParams.get('feedbackType')).toBe('thumbs');
    expect(url.searchParams.get('feedbackSource')).toBe('user');
    expect(url.searchParams.get('feedbackUserId')).toBe('user-1');
    // default preset is last-24h, so a timestamp range is included
    expect(url.searchParams.get('timestamp')).not.toBeNull();
  });

  it('renders an error state when the list endpoint fails', async () => {
    server.use(http.get(FEEDBACK_ENDPOINT, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    const { queryClient } = renderPage();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(await screen.findByText('Failed to load feedback')).not.toBeNull();
  });

  it('opens the feedback dialog with a trace deep-link on row click', async () => {
    server.use(http.get(FEEDBACK_ENDPOINT, () => HttpResponse.json(twoFeedbackRecords)));

    const { queryClient } = renderPage();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    screen.getByText('Great answer').click();

    const link = await screen.findByRole('link', { name: 'View trace' });
    expect(link.getAttribute('href')).toBe('/traces/trace-1?tab=feedback');
  });

  it('shows an "Add to dataset" action for feedback with a trace', async () => {
    server.use(http.get(FEEDBACK_ENDPOINT, () => HttpResponse.json(twoFeedbackRecords)));

    const { queryClient } = renderPage();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    screen.getByText('Great answer').click();

    expect(await screen.findByRole('button', { name: /Add to dataset/ })).not.toBeNull();
  });
});
