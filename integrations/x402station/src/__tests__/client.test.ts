import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Bypass the @x402/fetch wrap so paid fetches surface our fetchImpl directly
// in tests — we still want to assert request shape, but a real 402 round-trip
// is out of scope here.
vi.mock('@x402/fetch', () => ({
  wrapFetchWithPaymentFromConfig: (impl: typeof fetch) => impl,
}));
vi.mock('@x402/evm', () => ({
  ExactEvmScheme: class {
    constructor(_: unknown) {}
  },
}));
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: (_pk: string) => ({
    address: '0x30d2b1f9bcEdE5F13136b56Ff199A8ad6E4f50de',
    signTypedData: () => Promise.resolve('0x' + '00'.repeat(65)),
    signMessage: () => Promise.resolve('0x' + '00'.repeat(65)),
    signTransaction: () => Promise.resolve('0x' + '00'.repeat(65)),
  }),
}));

import { getX402StationClient  } from '../client.js';
import type {X402StationClientOptions} from '../client.js';

const VALID_PK = '0x' + 'a'.repeat(64);

interface CapturedCall {
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
}

function buildFetchImpl(res: { status: number; bodyText: string; headers?: Record<string, string> }): {
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
    return new Response(res.bodyText, { status: res.status, headers: new Headers(res.headers ?? {}) });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('getX402StationClient — baseUrl allow-list', () => {
  it('uses canonical https://x402station.io by default', () => {
    const c = getX402StationClient({ privateKey: VALID_PK });
    expect(c.baseUrl).toBe('https://x402station.io');
  });

  it('accepts explicit canonical host', () => {
    const c = getX402StationClient({ privateKey: VALID_PK, baseUrl: 'https://x402station.io' });
    expect(c.baseUrl).toBe('https://x402station.io');
  });

  it('strips trailing slashes', () => {
    const c = getX402StationClient({ privateKey: VALID_PK, baseUrl: 'https://x402station.io///' });
    expect(c.baseUrl).toBe('https://x402station.io');
  });

  it('accepts http://localhost dev URL', () => {
    const c = getX402StationClient({ privateKey: VALID_PK, baseUrl: 'http://localhost:3002' });
    expect(c.baseUrl).toBe('http://localhost:3002');
  });

  it('accepts IPv6 loopback dev URL [::1]', () => {
    const c = getX402StationClient({ privateKey: VALID_PK, baseUrl: 'http://[::1]:3002' });
    expect(c.baseUrl).toBe('http://[::1]:3002');
  });

  it('rejects non-canonical host', () => {
    expect(() => getX402StationClient({ privateKey: VALID_PK, baseUrl: 'https://evil.example' })).toThrow(
      /baseUrl must be/i,
    );
  });

  it('rejects malformed URL', () => {
    expect(() => getX402StationClient({ privateKey: VALID_PK, baseUrl: 'not a url' })).toThrow(/not a valid URL/i);
  });

  it('does not let a non-default port bypass the canonical check', () => {
    // u.hostname strips port; u.host keeps it. Implementation must use u.host.
    expect(() => getX402StationClient({ privateKey: VALID_PK, baseUrl: 'https://x402station.io:9999' })).toThrow(
      /baseUrl must be/i,
    );
  });
});

describe('getX402StationClient — account resolution', () => {
  const originalEnv = process.env.X402STATION_PRIVATE_KEY;
  beforeEach(() => {
    delete process.env.X402STATION_PRIVATE_KEY;
  });
  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.X402STATION_PRIVATE_KEY = originalEnv;
    } else {
      delete process.env.X402STATION_PRIVATE_KEY;
    }
  });

  it('throws on first paid call when no account / privateKey / env var set', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const c = getX402StationClient({ fetchImpl } as X402StationClientOptions);
    await expect(c.callPaid('/api/v1/preflight', {})).rejects.toThrow(/account.*required/i);
  });

  it('throws on malformed privateKey', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const c = getX402StationClient({ privateKey: 'not-a-hex-key', fetchImpl });
    await expect(c.callPaid('/api/v1/preflight', {})).rejects.toThrow(/malformed/i);
  });

  it('falls back to X402STATION_PRIVATE_KEY env var', async () => {
    process.env.X402STATION_PRIVATE_KEY = VALID_PK;
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const c = getX402StationClient({ fetchImpl });
    await c.callPaid('/api/v1/preflight', { url: 'https://x' });
    expect(calls).toHaveLength(1);
  });
});

describe('callPaid — request shape and receipt decoding', () => {
  it('POSTs to baseUrl + path with JSON body', async () => {
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: '{"ok":true}' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    await c.callPaid('/api/v1/preflight', { url: 'https://target' });
    expect(calls[0]!.url).toBe('https://x402station.io/api/v1/preflight');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]!.body)).toEqual({ url: 'https://target' });
  });

  it('returns null paymentReceipt when header absent', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 200, bodyText: '{}' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    const out = await c.callPaid('/api/v1/preflight', {});
    expect(out.paymentReceipt).toBeNull();
  });

  it('decodes the x-payment-response header into paymentReceipt', async () => {
    const receipt = { transaction: '0xabc', network: 'eip155:8453' };
    const headerVal = btoa(JSON.stringify(receipt));
    const { fetchImpl } = buildFetchImpl({
      status: 200,
      bodyText: '{}',
      headers: { 'x-payment-response': headerVal },
    });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    const out = await c.callPaid('/api/v1/preflight', {});
    expect(out.paymentReceipt).toEqual(receipt);
  });

  it('flags malformed payment-response header with malformed:true', async () => {
    const { fetchImpl } = buildFetchImpl({
      status: 200,
      bodyText: '{}',
      headers: { 'x-payment-response': 'not-base64-and-not-json!!!' },
    });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    const out = await c.callPaid('/api/v1/preflight', {});
    expect(out.paymentReceipt).toEqual({ raw: 'not-base64-and-not-json!!!', malformed: true });
  });

  it('throws a descriptive error on non-2xx', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 503, bodyText: 'upstream timeout' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    await expect(c.callPaid('/api/v1/preflight', {})).rejects.toThrow(/503.*upstream timeout/i);
  });

  it('throws when 200 body is not JSON (e.g. proxy returned HTML)', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 200, bodyText: '<!DOCTYPE html><html>...' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    await expect(c.callPaid('/api/v1/preflight', {})).rejects.toThrow(/non-JSON body/i);
  });

  it('aborts a hung fetch via AbortSignal.timeout', async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      return new Promise<Response>((_resolve, reject) => {
        if (!signal) return;
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }) as unknown as typeof fetch;
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl, timeoutMs: 50 });
    await expect(c.callPaid('/api/v1/preflight', {})).rejects.toThrow(/timed out after 50ms/);
  });
});

describe('callFree — secret-gated GET / DELETE', () => {
  it('GET sets x-x402station-secret header and no payment wrapper', async () => {
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: '{"isActive":true}' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    const out = (await c.callFree('/api/v1/watch/abc', 'GET', 'a'.repeat(64))) as { isActive: boolean };
    expect(out.isActive).toBe(true);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.headers['x-x402station-secret']).toBe('a'.repeat(64));
  });

  it('DELETE issues DELETE method', async () => {
    const { fetchImpl, calls } = buildFetchImpl({
      status: 200,
      bodyText: '{"watchId":"id","isActive":false,"message":"ok"}',
    });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    await c.callFree('/api/v1/watch/abc', 'DELETE', 'b'.repeat(64));
    expect(calls[0]!.method).toBe('DELETE');
  });

  it('throws on 404 (wrong secret OR missing watch — server returns 404 for both)', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 404, bodyText: '{"error":"watch not found"}' });
    const c = getX402StationClient({ privateKey: VALID_PK, fetchImpl });
    await expect(c.callFree('/api/v1/watch/abc', 'GET', 'c'.repeat(64))).rejects.toThrow(/404.*watch not found/i);
  });
});
