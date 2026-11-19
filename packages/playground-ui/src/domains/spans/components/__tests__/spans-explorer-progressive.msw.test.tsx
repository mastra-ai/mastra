// @vitest-environment jsdom
import type { AggregateSpansResponse, GetObservabilityCapabilitiesResponse, QuerySpansResult } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  emptyEntityNames,
  emptyEnvironments,
  spanAggregateCapabilities,
  spanRowsPage,
} from '../../__tests__/fixtures/spans';
import { SpansExplorerBody } from '../spans-explorer-body';
import { useFixedChartSize } from '@/test/chart-size';
import { chunkGate } from '@/test/chunk-gate';
import type { ChunkGate } from '@/test/chunk-gate';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';
import { SearchParamsHost } from '@/test/search-params-host';

const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;
const SPANS_AGGREGATE_URL = `${TEST_BASE_URL}/api/observability/spans/aggregate`;
const DAY = 24 * 60 * 60 * 1000;
const CHUNK = 7 * DAY;

const searchable: GetObservabilityCapabilitiesResponse = {
  ...spanAggregateCapabilities,
  capabilities: {
    ...spanAggregateCapabilities.capabilities,
    spanQueryTokenSearch: true,
    spanAggregateTokenSearch: true,
  },
};
const progressiveCapabilities: GetObservabilityCapabilitiesResponse = {
  ...searchable,
  capabilities: { ...searchable.capabilities, progressiveTokenSearch: true },
};

type Body = {
  timeRange: { from: string; to: string };
  progressive?: true;
  continuation?: string;
  orderBy?: Array<{ field: string }>;
};

/**
 * Like the server with #5246: a progressive request searches one 7-day chunk, newest first. The continuation is
 * the next chunk's index; `searchedRange` covers every chunk so far.
 */
function chunkOf(body: Body) {
  const index = Number(body.continuation ?? 0);
  const fromMs = Date.parse(body.timeRange.from);
  const toMs = Date.parse(body.timeRange.to);
  const chunkFrom = Math.max(fromMs, toMs - (index + 1) * CHUNK);
  return {
    index,
    chunkTo: toMs - index * CHUNK,
    searchedRange: { from: new Date(chunkFrom).toISOString(), to: body.timeRange.to },
    continuation: chunkFrom > fromMs ? String(index + 1) : null,
  };
}

const chunkedAggregate = (body: Body): AggregateSpansResponse => {
  const { chunkTo, searchedRange, continuation } = chunkOf(body);
  return {
    rows: [{ bucket: new Date(chunkTo - DAY).toISOString(), measures: { count: 5, errorCount: 1 } }],
    truncated: false,
    searchedRange,
    continuation,
    mergeable: true,
  };
};

const chunkedSpans = (body: Body): QuerySpansResult => {
  const { searchedRange, continuation } = chunkOf(body);
  return { ...spanRowsPage, page: { next: null }, searchedRange, continuation };
};

const renderAt = ({
  capabilities = progressiveCapabilities,
  aggregate = body => HttpResponse.json(chunkedAggregate(body)),
  gate,
}: {
  capabilities?: GetObservabilityCapabilitiesResponse;
  aggregate?: (body: Body) => Response | Promise<Response>;
  /** Holds each chart chunk until the test lets it through. */
  gate?: ChunkGate;
} = {}) => {
  const queries: Body[] = [];
  const aggregates: Body[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as Body;
      if (body.orderBy?.[0]?.field !== 'endedAt') queries.push(body);
      return HttpResponse.json(body.progressive ? chunkedSpans(body) : spanRowsPage);
    }),
    http.post(SPANS_AGGREGATE_URL, async ({ request }) => {
      const body = (await request.json()) as Body;
      aggregates.push(body);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await gate?.pass(body.continuation);
        return await aggregate(body);
      } finally {
        inFlight -= 1;
      }
    }),
  );
  renderWithProviders(
    <SearchParamsHost initial="datePreset=last-30d&filter.all=weather&filter.all.op=hasAllTokens">
      {urlState => (
        <SpansExplorerBody
          selection={undefined}
          onSelectionChange={() => {}}
          renderPanel={() => null}
          urlState={urlState}
        />
      )}
    </SearchParamsHost>,
  );
  return { queries, aggregates, maxInFlight: () => maxInFlight };
};

// Spinners and the search-params readout are statuses too.
const progressLine = () => screen.queryAllByRole('status').find(element => element.tagName === 'P');
const status = () => progressLine()?.textContent;

/** Waits for the status after each chunk, then lets the next one through. */
async function stepThrough(gate: ChunkGate, days: number[]) {
  for (const day of days) {
    await waitFor(() => expect(status()).toBe(`Searched the last ${day} of 30 days…`));
    gate.next();
  }
}

describe('SpansExplorerBody progressive word search', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
    window.localStorage.clear();
  });
  afterEach(() => window.localStorage.clear());

  describe('when the server searches in chunks', () => {
    it('lists a time-to-first-chunk sort without progressive, since the server chunks only start-time sorts', async () => {
      const { queries } = renderAt();
      await waitFor(() => expect(queries[0]).toMatchObject({ progressive: true }));

      const columns = await screen.findByRole<HTMLButtonElement>('button', { name: 'Columns' });
      await waitFor(() => expect(columns.disabled).toBe(false));
      fireEvent.click(columns);
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Time to first chunk' }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      fireEvent.click(await screen.findByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' }));

      await waitFor(() => expect(queries.at(-1)?.orderBy?.[0]?.field).toBe('timeToFirstChunkMs'));
      expect(queries.at(-1)).not.toHaveProperty('progressive');
    });

    it('charts the 30 days one chunk at a time, newest first, then says it searched them all', async () => {
      const gate = chunkGate();
      const { queries, aggregates, maxInFlight } = renderAt({ gate });

      await stepThrough(gate, [7, 14, 21, 28]);
      await waitFor(() => expect(status()).toBe('Searched all 30 days.'));
      expect(aggregates.map(body => body.continuation)).toEqual([undefined, '1', '2', '3', '4']);
      expect(aggregates.every(body => body.progressive === true)).toBe(true);
      expect(maxInFlight()).toBe(1);
      expect(queries[0]).toMatchObject({ progressive: true });
      expect(queries[0]?.continuation).toBeUndefined();
      expect(screen.queryByTestId('histogram-pending-band')).toBeNull();
    });

    it('shows how far it got with the older days pending, and Stop holds it there', async () => {
      const gate = chunkGate();
      const { aggregates } = renderAt({ gate });

      await stepThrough(gate, [7]);
      await waitFor(() => expect(status()).toBe('Searched the last 14 of 30 days…'));
      expect(screen.getByTestId('histogram-pending-band')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
      expect(status()).toBe('Stopped after the last 14 of 30 days.');
      // The chunk already asked for lands; no later one is asked for.
      gate.next();
      await waitFor(() => expect(status()).toBe('Stopped after the last 21 of 30 days.'));
      expect(aggregates.map(body => body.continuation)).toEqual([undefined, '1', '2']);

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await stepThrough(gate, [21, 28]);
      await waitFor(() => expect(status()).toBe('Searched all 30 days.'));
      expect(aggregates.map(body => body.continuation)).toEqual([undefined, '1', '2', '3', '4']);
    });

    it('keeps the chunks it charted when a later one takes too long, and tries again', async () => {
      let failing = true;
      const gate = chunkGate();
      renderAt({
        gate,
        aggregate: body =>
          failing && body.continuation === '2'
            ? HttpResponse.json(
                { type: 'about:blank', title: 'Search took too long', status: 504, name: 'search_too_expensive' },
                { status: 504 },
              )
            : HttpResponse.json(chunkedAggregate(body)),
      });

      await stepThrough(gate, [7, 14]);
      await waitFor(() => expect(status()).toBe("Couldn't search past the last 14 of 30 days."));
      expect(screen.getByRole('region', { name: 'Spans over time' }).textContent).toContain('10 spans');
      expect(screen.getByText('agent run: weather')).toBeTruthy();

      failing = false;
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await stepThrough(gate, [21, 28]);
      await waitFor(() => expect(status()).toBe('Searched all 30 days.'));
    });

    it('charts only the newest chunk, with a note, when the server cannot merge chunks', async () => {
      const { aggregates } = renderAt({
        aggregate: body => HttpResponse.json({ ...chunkedAggregate(body), mergeable: false }),
      });

      await screen.findByText('The chart covers the last 7 days of this search.');
      await act(() => delay(200));
      expect(aggregates).toHaveLength(1);
    });
  });

  describe('when the server does not search in chunks', () => {
    it('sends no progressive fields and shows no progress', async () => {
      const { queries, aggregates } = renderAt({
        capabilities: searchable,
        aggregate: () => HttpResponse.json<AggregateSpansResponse>({ rows: [], truncated: false }),
      });

      await waitFor(() => expect(aggregates.length).toBeGreaterThan(0));
      await waitFor(() => expect(queries.length).toBeGreaterThan(0));
      expect(queries.every(body => !('progressive' in body))).toBe(true);
      expect(aggregates.every(body => !('progressive' in body))).toBe(true);
      expect(progressLine()).toBeUndefined();
    });
  });
});
