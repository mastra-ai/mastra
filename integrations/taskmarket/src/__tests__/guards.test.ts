import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TaskmarketClient } from '../client.js';
import {
  TaskmarketFundingError,
  TaskmarketNetworkError,
  assertBaseNetwork,
  assertSufficientBalance,
} from '../create.js';

const FAKE_CLI = `#!/usr/bin/env node
const mode = (process.argv[2] ?? '') + (process.argv[3] ? ' ' + process.argv[3] : '');
const out = { ok: true, data: {} };
let code = 0;
if (mode === 'deposit') {
  out.data = {
    address: '0x7e0190af0951485dFd08bE2FE19Fa638e94F426D',
    network: process.env.FAKE_NETWORK || 'Base',
    chainId: Number(process.env.FAKE_CHAIN_ID || '8453'),
    currency: 'USDC',
    usdcContract: process.env.FAKE_USDC || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  };
} else if (mode === 'wallet balance') {
  out.data = {
    address: '0x7e0190af0951485dFd08bE2FE19Fa638e94F426D',
    balanceBaseUnits: process.env.FAKE_BALANCE || '25000000',
    balanceUsdc: String((Number(process.env.FAKE_BALANCE || '25000000') / 1000000).toFixed(6)),
  };
} else {
  out.data = { taskId: '0x' + 'ab'.repeat(32) };
  if (process.env.FAKE_FAIL === '1') {
    out.ok = false;
    out.error = 'simulated failure';
    code = 1;
  }
}
process.stdout.write(JSON.stringify(out) + '\\n');
process.exit(code);
`;

function fakeCliPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tm-fake-cli-'));
  const path = join(dir, 'taskmarket');
  writeFileSync(path, FAKE_CLI, { mode: 0o755 });
  return path;
}

describe('assertBaseNetwork', () => {
  let cliPath: string;
  let client: TaskmarketClient;

  beforeEach(() => {
    cliPath = fakeCliPath();
    client = new TaskmarketClient({ cliPath });
  });

  afterEach(() => {
    delete process.env.FAKE_NETWORK;
    delete process.env.FAKE_CHAIN_ID;
    delete process.env.FAKE_USDC;
  });

  it('accepts the production Base network', async () => {
    const deposit = await assertBaseNetwork(client);
    expect(deposit.chainId).toBe(8453);
    expect(deposit.network).toBe('Base');
    expect(deposit.usdcContract).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('refuses a non-Base chain id', async () => {
    process.env.FAKE_CHAIN_ID = '1';
    await expect(assertBaseNetwork(client)).rejects.toThrow(TaskmarketNetworkError);
    await expect(assertBaseNetwork(client)).rejects.toThrow(/Refusing to act/);
  });

  it('refuses a non-Base network name', async () => {
    process.env.FAKE_NETWORK = 'Ethereum';
    await expect(assertBaseNetwork(client)).rejects.toThrow(/Refusing to act/);
  });

  it('refuses a mismatched USDC contract', async () => {
    process.env.FAKE_USDC = '0x0000000000000000000000000000000000000000';
    await expect(assertBaseNetwork(client)).rejects.toThrow(/USDC contract/);
  });
});

describe('assertSufficientBalance', () => {
  let cliPath: string;
  let client: TaskmarketClient;

  beforeEach(() => {
    cliPath = fakeCliPath();
    client = new TaskmarketClient({ cliPath });
  });

  afterEach(() => {
    delete process.env.FAKE_BALANCE;
  });

  it('accepts a sufficient balance', async () => {
    process.env.FAKE_BALANCE = '30000000';
    const result = await assertSufficientBalance(client, '25');
    expect(result.balanceUsdc).toBe('30.000000');
  });

  it('accepts an exactly sufficient balance', async () => {
    process.env.FAKE_BALANCE = '25000000';
    await expect(assertSufficientBalance(client, '25')).resolves.toBeDefined();
  });

  it('refuses an insufficient balance', async () => {
    process.env.FAKE_BALANCE = '1000000';
    await expect(assertSufficientBalance(client, '25')).rejects.toThrow(TaskmarketFundingError);
    await expect(assertSufficientBalance(client, '25')).rejects.toThrow(/Insufficient USDC/);
  });

  it('compares in base units without float rounding', async () => {
    process.env.FAKE_BALANCE = '24999999';
    await expect(assertSufficientBalance(client, '25')).rejects.toThrow(/Insufficient USDC/);
  });
});
