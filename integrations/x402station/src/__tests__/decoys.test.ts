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

import { createX402StationCatalogDecoysTool } from '../decoys.js';

const VALID_PK = '0x' + 'a'.repeat(64);

describe('createX402StationCatalogDecoysTool', () => {
  it('POSTs an empty body to /api/v1/catalog/decoys', async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : typeof input === 'string' ? input : input.toString();
      const body = input instanceof Request ? await input.clone().text() : (typeof init?.body === 'string' ? init.body : '');
      calls.push({ url, body });
      return new Response(
        JSON.stringify({
          generated_at: '2026-04-27T00:00:00Z',
          counts: { total: 0, by_reason: {} },
          truncated: false,
          entries: [],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const tool = createX402StationCatalogDecoysTool({ privateKey: VALID_PK, fetchImpl });
    expect(tool.id).toBe('x402station-catalog-decoys');

    await tool.execute!({}, {} as never);
    expect(calls[0]!.url).toBe('https://x402station.io/api/v1/catalog/decoys');
    expect(calls[0]!.body).toBe('{}');
  });
});
