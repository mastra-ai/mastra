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

import { createX402StationTools } from '../tools.js';

const VALID_PK = '0x' + 'a'.repeat(64);

describe('createX402StationTools', () => {
  it('returns all six tools with correct ids', () => {
    const tools = createX402StationTools({ privateKey: VALID_PK });
    expect(tools.x402StationPreflight.id).toBe('x402station-preflight');
    expect(tools.x402StationForensics.id).toBe('x402station-forensics');
    expect(tools.x402StationCatalogDecoys.id).toBe('x402station-catalog-decoys');
    expect(tools.x402StationWatchSubscribe.id).toBe('x402station-watch-subscribe');
    expect(tools.x402StationWatchStatus.id).toBe('x402station-watch-status');
    expect(tools.x402StationWatchUnsubscribe.id).toBe('x402station-watch-unsubscribe');
  });

  it('every tool has description, inputSchema, outputSchema', () => {
    const tools = createX402StationTools({ privateKey: VALID_PK });
    for (const tool of Object.values(tools)) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });
});
