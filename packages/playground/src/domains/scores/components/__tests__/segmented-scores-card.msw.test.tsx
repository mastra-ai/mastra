import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedScoresCard } from '../segmented-scores-card';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const BASE_URL = 'http://localhost:4111';

const aggregateRows = {
  rows: [
    {
      bucketStart: '2026-08-19T00:00:00.000Z',
      groups: ['oncology'],
      count: 12,
      avg: 0.82,
      p50: 0.85,
      p95: 0.95,
      passRate: 0.75,
    },
    {
      bucketStart: '2026-08-19T00:00:00.000Z',
      groups: [null],
      count: 3,
      avg: 0.4,
      p50: 0.4,
      p95: 0.5,
      passRate: 0,
    },
  ],
};

describe('SegmentedScoresCard', () => {
  it('populates the group-by picker from the metadata-keys endpoint and drives the aggregate query', async () => {
    const onAggregateRequest = vi.fn<(groupBy: string | null, bucket: string | null) => void>();
    server.use(
      http.get(`${BASE_URL}/api/scores/metadata-keys`, () => HttpResponse.json({ keys: ['cohort', 'deployment'] })),
      http.get(`${BASE_URL}/api/scores/aggregate`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        onAggregateRequest(params.get('groupBy'), params.get('bucket'));
        return HttpResponse.json(aggregateRows);
      }),
    );

    renderWithProviders(<SegmentedScoresCard />);

    // Initial fetch: default day bucket, no grouping
    await waitFor(() => expect(onAggregateRequest).toHaveBeenCalledWith(null, 'day'));
    expect(await screen.findByText('oncology')).toBeTruthy();
    expect(screen.getByText('(none)')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();

    // Metadata keys populate the picker
    fireEvent.click(screen.getByLabelText('Group by'));
    const cohortOption = await screen.findByRole('option', { name: 'metadata: cohort' });
    expect(screen.getByRole('option', { name: 'metadata: deployment' })).toBeTruthy();

    // Selecting a metadata key re-queries with groupBy
    fireEvent.pointerDown(cohortOption, { pointerType: 'mouse' });
    fireEvent.click(cohortOption, { detail: 1 });
    await waitFor(() => expect(onAggregateRequest).toHaveBeenCalledWith('metadata:cohort', 'day'));
  });

  it('renders an empty state when there are no rows', async () => {
    server.use(
      http.get(`${BASE_URL}/api/scores/metadata-keys`, () => HttpResponse.json({ keys: [] })),
      http.get(`${BASE_URL}/api/scores/aggregate`, () => HttpResponse.json({ rows: [] })),
    );

    renderWithProviders(<SegmentedScoresCard />);

    expect(await screen.findByText('No scores in this window')).toBeTruthy();
  });
});
