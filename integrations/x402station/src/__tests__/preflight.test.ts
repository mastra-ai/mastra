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

import { createX402StationPreflightTool } from '../preflight.js';

const VALID_PK = '0x' + 'a'.repeat(64);

interface CapturedCall {
  url: string;
  method: string;
  body: string;
}

function buildFetchImpl(res: { status: number; bodyText: string }): {
  fetchImpl: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : typeof input === 'string' ? input : input.toString();
    const method = input instanceof Request ? input.method : (init?.method ?? 'GET');
    const body = input instanceof Request ? await input.clone().text() : (typeof init?.body === 'string' ? init.body : '');
    calls.push({ url, method, body });
    return new Response(res.bodyText, { status: res.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('createX402StationPreflightTool', () => {
  it('has correct id, description, schemas', () => {
    const tool = createX402StationPreflightTool({ privateKey: VALID_PK });
    expect(tool.id).toBe('x402station-preflight');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('POSTs the URL to /api/v1/preflight and returns parsed body', async () => {
    const fakeBody = {
      ok: false,
      warnings: ['dead', 'zombie'],
      metadata: { url: 'https://api.venice.ai/api/v1/chat/completions' },
    };
    const { fetchImpl, calls } = buildFetchImpl({ status: 200, bodyText: JSON.stringify(fakeBody) });
    const tool = createX402StationPreflightTool({ privateKey: VALID_PK, fetchImpl });
    const result = (await tool.execute!(
      { url: 'https://api.venice.ai/api/v1/chat/completions' },
      {} as never,
    )) as { result: typeof fakeBody; paymentReceipt: unknown };

    expect(result.result).toEqual(fakeBody);
    expect(result.paymentReceipt).toBeNull();
    expect(calls[0]!.url).toBe('https://x402station.io/api/v1/preflight');
    expect(calls[0]!.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body)).toEqual({ url: 'https://api.venice.ai/api/v1/chat/completions' });
  });

  it('lets a 503 from the oracle propagate as a thrown error', async () => {
    const { fetchImpl } = buildFetchImpl({ status: 503, bodyText: 'upstream timeout' });
    const tool = createX402StationPreflightTool({ privateKey: VALID_PK, fetchImpl });
    await expect(tool.execute!({ url: 'https://target' }, {} as never)).rejects.toThrow(/503/);
  });
});
