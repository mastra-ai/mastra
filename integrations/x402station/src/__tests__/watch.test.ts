import { describe, it, expect, vi } from 'vitest';

vi.mock('@x402/fetch', () => ({
  wrapFetchWithPaymentFromConfig: (impl: typeof fetch) => impl,
}));
vi.mock('@x402/evm', () => ({
  ExactEvmScheme: class {
    constructor(_: unknown) {}
  },
}));
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: (_pk: string) => ({ address: '0x30d2b1f9bcEdE5F13136b56Ff199A8ad6E4f50de' }),
}));

import { WatchSubscribeInputSchema } from '../schemas.js';
import {
  createX402StationWatchStatusTool,
  createX402StationWatchSubscribeTool,
  createX402StationWatchUnsubscribeTool,
} from '../watch.js';

const VALID_PK = '0x' + 'a'.repeat(64);
const VALID_ID = '0a44f6b8-3b7d-4f2a-9e3a-2c5fd1b0aa11';
const VALID_SECRET = 'a'.repeat(64);

interface CapturedCall {
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
}

function buildFetchImpl(res: { status: number; bodyText: string }): {
  fetchImpl: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let method: string;
    let body: string;
    let headers: Record<string, string>;
    if (input instanceof Request) {
      url = input.url;
      method = input.method;
      headers = Object.fromEntries(input.headers);
      body = await input.clone().text();
    } else {
      url = typeof input === 'string' ? input : input.toString();
      method = init?.method ?? 'GET';
      const rawHeaders = init?.headers ?? {};
      headers =
        rawHeaders instanceof Headers
          ? Object.fromEntries(rawHeaders)
          : Array.isArray(rawHeaders)
            ? Object.fromEntries(rawHeaders)
            : (rawHeaders as Record<string, string>);
      body = typeof init?.body === 'string' ? init.body : '';
    }
    calls.push({ url, method, body, headers });
    return new Response(res.bodyText, { status: res.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('createX402StationWatchSubscribeTool', () => {
  it('omits signals from POST body when not provided', async () => {
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const tool = createX402StationWatchSubscribeTool({ privateKey: VALID_PK, fetchImpl });
    await tool.execute!({ url: 'https://target', webhookUrl: 'https://hook.example' }, {} as never);
    const body = JSON.parse(calls[0]!.body);
    expect(body).toEqual({ url: 'https://target', webhookUrl: 'https://hook.example' });
    expect(body).not.toHaveProperty('signals');
  });

  it('includes signals in POST body when provided', async () => {
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const tool = createX402StationWatchSubscribeTool({ privateKey: VALID_PK, fetchImpl });
    await tool.execute!(
      { url: 'https://target', webhookUrl: 'https://hook.example', signals: ['zombie', 'decoy_price_extreme'] },
      {} as never,
    );
    const body = JSON.parse(calls[0]!.body);
    expect(body.signals).toEqual(['zombie', 'decoy_price_extreme']);
  });

  it('rejects http:// webhookUrl at the schema level (HMAC payloads must travel encrypted)', () => {
    const result = WatchSubscribeInputSchema.safeParse({
      url: 'https://target',
      webhookUrl: 'http://insecure-webhook.example',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/HTTPS/);
    }
  });

  it('rejects an unknown signal at the schema level', () => {
    const result = WatchSubscribeInputSchema.safeParse({
      url: 'https://target',
      webhookUrl: 'https://hook.example',
      signals: ['bogus' as never],
    });
    expect(result.success).toBe(false);
  });
});

describe('createX402StationWatchStatusTool', () => {
  it('GET /api/v1/watch/{id} with secret header (no payment wrapper)', async () => {
    const fullStatus = {
      watchId: VALID_ID,
      endpointUrl: 'https://target',
      webhookUrl: 'https://hook.example',
      signals: [],
      createdAt: '2026-04-27T00:00:00Z',
      expiresAt: '2026-05-27T00:00:00Z',
      alertsPaid: 100,
      alertsSent: 0,
      alertsRemaining: 100,
      lastState: null,
      isActive: true,
      expired: false,
      recentAlerts: [],
    };
    const { fetchImpl, calls } = buildFetchImpl({
      status: 200,
      bodyText: JSON.stringify(fullStatus),
    });
    const tool = createX402StationWatchStatusTool({ privateKey: VALID_PK, fetchImpl });
    const out = (await tool.execute!({ watchId: VALID_ID, secret: VALID_SECRET }, {} as never)) as {
      isActive: boolean;
      alertsRemaining: number;
    };
    expect(out.isActive).toBe(true);
    expect(out.alertsRemaining).toBe(100);
    expect(calls[0]!.url).toBe(`https://x402station.io/api/v1/watch/${VALID_ID}`);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.headers['x-x402station-secret']).toBe(VALID_SECRET);
  });
});

describe('createX402StationWatchUnsubscribeTool', () => {
  it('issues DELETE', async () => {
    const { fetchImpl, calls } = buildFetchImpl({
      status: 200,
      bodyText: JSON.stringify({ watchId: VALID_ID, isActive: false, message: 'unsubscribed' }),
    });
    const tool = createX402StationWatchUnsubscribeTool({ privateKey: VALID_PK, fetchImpl });
    await tool.execute!({ watchId: VALID_ID, secret: VALID_SECRET }, {} as never);
    expect(calls[0]!.method).toBe('DELETE');
  });
});
