// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { runCircle, runCircleJson } from './cli';
import { chainCli, DEFAULT_CHAIN, type Chain } from './chains';
import type { GatewayBalance, GatewayDepositResult } from './types';

const READ_RETRIES = 3;
const TX_HASH_REGEX = /0x[a-fA-F0-9]{64}/;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface GatewayBalanceInput {
  address: string;
  chain?: Chain;
}

// `direct` deposits on `chain` itself: works anywhere, 13-19 min, costs gas. `eco` is ~30s and
// gasless, but the CLI forces source=BASE and destination=Polygon, so it only settles on Polygon.
export type GatewayDepositMethod = 'direct' | 'eco';

export interface GatewayDepositInput {
  address: string;
  amount: number;
  chain?: Chain;
  method?: GatewayDepositMethod;
}

interface RawGatewayRow {
  network?: string;
  domain?: number;
  balance?: string | number;
}

interface RawGatewayData {
  address?: string;
  total?: string | number;
  balances?: RawGatewayRow[];
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Unwrap the `{ data: ... }` envelope the CLI puts around JSON output.
function unwrap(raw: unknown): RawGatewayData {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (o.data && typeof o.data === 'object') return o.data as RawGatewayData;
  return o as RawGatewayData;
}

// The Gateway balance is the off-chain batched-payment pool, not the on-chain one.
export async function gatewayBalance(input: GatewayBalanceInput): Promise<GatewayBalance> {
  const raw = await runCircleJson<unknown>(
    [
      'gateway',
      'balance',
      '--address',
      input.address,
      '--chain',
      chainCli(input.chain ?? DEFAULT_CHAIN),
      '--output',
      'json',
    ],
    { retries: READ_RETRIES },
  );
  const data = unwrap(raw);
  const total =
    data.total !== undefined
      ? String(data.total)
      : String((data.balances ?? []).reduce((sum, r) => sum + toNumber(r.balance), 0));
  return { address: data.address ?? input.address, total };
}

function extractDepositId(out: string): string | undefined {
  return out.match(TX_HASH_REGEX)?.[0] ?? out.match(UUID_REGEX)?.[0];
}

// Mutating, so retries stay at 0 and a dropped connection never double-deposits.
export async function gatewayDeposit(input: GatewayDepositInput): Promise<GatewayDepositResult> {
  const destChain = input.chain ?? DEFAULT_CHAIN;
  const requestedMethod: GatewayDepositMethod = input.method ?? 'direct';

  // eco only lands on Polygon, so pairing it with another chain would deposit into the wrong
  // Gateway domain and the follow-up balance read would fail. Downgrade instead.
  const method: GatewayDepositMethod =
    requestedMethod === 'eco' && destChain !== 'POLYGON' ? 'direct' : requestedMethod;

  const cliSourceChain = method === 'eco' ? chainCli('BASE') : chainCli(destChain);

  const out = await runCircle([
    'gateway',
    'deposit',
    '--amount',
    String(input.amount),
    '--address',
    input.address,
    '--chain',
    cliSourceChain,
    '--method',
    method,
    '--output',
    'json',
  ]);
  return {
    amount: String(input.amount),
    txId: extractDepositId(out.trim()),
    method,
  };
}
