import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMastraGatewayCatalog, resetMastraGatewayCatalogCacheForTests } from './gateway-catalog.js';

const BASE_URL = 'https://gateway.test';
const MODELS_URL = `${BASE_URL}/v1/models`;

const gateway = setupServer();
let reply: (key: string | null) => Response | Promise<Response>;
const requests: Array<string | null> = [];

const catalog = (...ids: string[]) => Response.json({ data: ids.map(id => ({ id, endpoints: ['chat'] })) });
const fetchFor = (apiKey: string) => fetchMastraGatewayCatalog({ apiKey, baseUrl: BASE_URL });
const minutesLater = (minutes: number) => vi.spyOn(Date, 'now').mockReturnValue(start + minutes * 60_000);

let start: number;

beforeAll(() => gateway.listen({ onUnhandledRequest: 'error' }));
afterAll(() => gateway.close());
beforeEach(() => {
  resetMastraGatewayCatalogCacheForTests();
  requests.length = 0;
  start = Date.now();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  gateway.use(
    http.get(MODELS_URL, ({ request }) => {
      const key = request.headers.get('authorization');
      requests.push(key);
      return reply(key);
    }),
  );
});
afterEach(() => {
  gateway.resetHandlers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchMastraGatewayCatalog', () => {
  it('serves the last list through a gateway outage, but not past an hour', async () => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor('mskv2_a');
    reply = () => new Response(null, { status: 503 });

    minutesLater(5);
    expect((await fetchFor('mskv2_a'))?.models).toEqual(['anthropic/claude-opus-4-5']);
    minutesLater(61);
    expect(await fetchFor('mskv2_a')).toBeUndefined();
  });

  it('serves the last list when the gateway cannot be reached', async () => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor('mskv2_a');
    reply = () => HttpResponse.error();

    minutesLater(5);
    expect((await fetchFor('mskv2_a'))?.models).toEqual(['anthropic/claude-opus-4-5']);
  });

  it.each([401, 403])('drops the list once the gateway refuses the key with %i', async status => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor('mskv2_a');
    reply = () => new Response(null, { status });

    minutesLater(5);
    expect(await fetchFor('mskv2_a')).toBeUndefined();
    minutesLater(5.1);
    expect(await fetchFor('mskv2_a')).toBeUndefined();
  });

  it("never answers one key with another key's list", async () => {
    reply = key => (key === 'Bearer mskv2_old' ? catalog('anthropic/claude-opus-4-5') : catalog('openai/gpt-5'));
    await fetchFor('mskv2_old');

    expect((await fetchFor('mskv2_new'))?.models).toEqual(['openai/gpt-5']);
    expect(requests).toEqual(['Bearer mskv2_old', 'Bearer mskv2_new']);
  });

  it('shares one fetch between concurrent callers and logs a failing gateway once', async () => {
    reply = () => new Response(null, { status: 503 });

    await Promise.all([fetchFor('mskv2_a'), fetchFor('mskv2_a')]);
    minutesLater(1);
    await fetchFor('mskv2_a');

    expect(requests).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a gateway that hangs, and keeps what the fetch brings back', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    reply = async () => {
      await released;
      return catalog('anthropic/claude-opus-4-5');
    };

    const waiting = fetchFor('mskv2_a');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await waiting).toBeUndefined();

    release();
    await vi.waitFor(async () => expect((await fetchFor('mskv2_a'))?.models).toEqual(['anthropic/claude-opus-4-5']));
    expect(requests).toHaveLength(1);
  });
});
