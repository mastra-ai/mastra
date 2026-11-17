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
// The gateway client caches a list per key for the life of the process, so each test uses its own key.
let testNumber = 0;
let key: string;

beforeAll(() => gateway.listen({ onUnhandledRequest: 'error' }));
afterAll(() => gateway.close());
beforeEach(() => {
  resetMastraGatewayCatalogCacheForTests();
  requests.length = 0;
  start = Date.now();
  key = `mskv2_test${++testNumber}`;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  gateway.use(
    http.get(MODELS_URL, ({ request }) => {
      const authorization = request.headers.get('authorization');
      requests.push(authorization);
      return reply(authorization);
    }),
  );
});
afterEach(() => {
  gateway.resetHandlers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchMastraGatewayCatalog', () => {
  it('returns the list the key may use, fetched once for repeated calls', async () => {
    reply = () => catalog('anthropic/claude-opus-4-5');

    expect((await fetchFor(key))?.models).toEqual(['anthropic/claude-opus-4-5']);
    expect((await fetchFor(key))?.models).toEqual(['anthropic/claude-opus-4-5']);
    expect(requests).toEqual([`Bearer ${key}`]);
  });

  it('keeps the last list through a gateway outage', async () => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor(key);
    reply = () => new Response(null, { status: 503 });

    minutesLater(5);
    expect((await fetchFor(key))?.models).toEqual(['anthropic/claude-opus-4-5']);
    expect(requests).toHaveLength(2);
  });

  it('keeps the last list when the gateway cannot be reached', async () => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor(key);
    reply = () => HttpResponse.error();

    minutesLater(5);
    expect((await fetchFor(key))?.models).toEqual(['anthropic/claude-opus-4-5']);
  });

  it.each([401, 403])('drops the list once the gateway refuses the key with %i', async status => {
    reply = () => catalog('anthropic/claude-opus-4-5');
    await fetchFor(key);
    reply = () => new Response(null, { status });

    minutesLater(5);
    expect(await fetchFor(key)).toBeUndefined();
    minutesLater(5.1);
    expect(await fetchFor(key)).toBeUndefined();
  });

  it("never answers one key with another key's list", async () => {
    const other = `${key}_other`;
    reply = authorization =>
      authorization === `Bearer ${key}` ? catalog('anthropic/claude-opus-4-5') : catalog('openai/gpt-5');
    await fetchFor(key);

    expect((await fetchFor(other))?.models).toEqual(['openai/gpt-5']);
    expect(requests).toEqual([`Bearer ${key}`, `Bearer ${other}`]);
  });

  it('answers with nothing when the gateway fails, without throwing, and logs it once', async () => {
    reply = () => new Response(null, { status: 503 });

    expect(await Promise.all([fetchFor(key), fetchFor(key)])).toEqual([undefined, undefined]);
    minutesLater(1);
    expect(await fetchFor(key)).toBeUndefined();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(key);
  });

  it('logs again when a gateway that recovered fails once more', async () => {
    reply = () => new Response(null, { status: 503 });
    await fetchFor(key);
    reply = () => catalog('anthropic/claude-opus-4-5');
    minutesLater(1);
    await fetchFor(key);
    reply = () => new Response(null, { status: 401 });
    minutesLater(5);
    await fetchFor(key);

    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('stops waiting for a gateway that hangs, and has the list once the fetch lands', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    reply = async () => {
      await released;
      return catalog('anthropic/claude-opus-4-5');
    };

    const waiting = fetchFor(key);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await waiting).toBeUndefined();

    release();
    await vi.waitFor(async () => expect((await fetchFor(key))?.models).toEqual(['anthropic/claude-opus-4-5']));
    expect(requests).toHaveLength(1);
  });
});
