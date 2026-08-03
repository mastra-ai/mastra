// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { runCircle, runCircleJson } from './cli';
import { chainCli, chainRpcUrl, chainUsdcAddress, DEFAULT_CHAIN, type Chain } from './chains';
import type { AgentWallet, TokenBalance, WalletBalance } from './types';

// Agent wallets share one address across every EVM chain, so listing on Base is enough.
const WALLET_LIST_CHAIN = chainCli(DEFAULT_CHAIN);
const EVM_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/;
const EVM_ADDRESS_EXACT = /^0x[a-fA-F0-9]{40}$/;
const USDC_DECIMALS = 6;
const TX_HASH_REGEX = /0x[a-fA-F0-9]{64}/;
const HTTPS_URL_REGEX = /https?:\/\/[^\s"']+/;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const READ_RETRIES = 3;

const DEPLOY_POLL_INTERVAL_MS = 1_500;
const DEPLOY_POLL_TIMEOUT_MS = 45_000;

export interface GetBalanceInput {
  address: string;
  chain?: Chain;
}

export interface DeployWalletInput {
  address: string;
  chain?: Chain;
}

export type FundMethod = 'crypto' | 'fiat';

export interface FundWalletInput {
  address: string;
  // `crypto` draws from the testnet faucet, `fiat` runs the test card flow. Defaults to `crypto`.
  method?: FundMethod;
  chain?: Chain;
}

export type FundToken = 'usdc' | 'eurc' | 'eth' | 'native';

export interface FundFiatInput {
  address: string;
  amount: number | string;
  chain?: Chain;
  token?: FundToken;
}

export interface FundFiatResult {
  address: string;
  chain: Chain;
  amount: string;
  token: FundToken;
  // The Transak on-ramp URL. Generating it moves no money on its own.
  url: string;
}

export interface TransferUsdcInput {
  // Source wallet, which must be one of this agent's own wallets.
  address: string;
  to: string;
  amount: number | string;
  chain?: Chain;
  // Passed to the CLI so a resubmission of the same intent settles once. Optional: the CLI
  // generates one per call when it is omitted, which is the right default for a fresh transfer.
  idempotencyKey?: string;
}

export interface TransferUsdcResult {
  from: string;
  to: string;
  amount: string;
  chain: Chain;
  txId?: string;
}

export interface DeployWalletResult {
  address: string;
  deployed: boolean;
  alreadyDeployed: boolean;
  txId?: string;
}

interface RawWallet {
  address: string;
  blockchain?: string;
}

// The CLI wraps every `--output json` payload in a `{ data: ... }` envelope.
interface CircleEnvelope<T> {
  data?: T;
}

interface RawWalletList {
  wallets?: RawWallet[];
}

interface RawTokenBalance {
  amount?: string;
  token?: { symbol?: string };
  symbol?: string;
}

interface RawBalance {
  address?: string;
  blockchain?: string;
  tokens?: RawTokenBalance[];
  balances?: RawTokenBalance[];
}

export async function createWallet(): Promise<AgentWallet> {
  const out = await runCircle(['wallet', 'create', '--chain', WALLET_LIST_CHAIN, '--output', 'json']);
  const trimmed = out.trim();
  let address: string | undefined;
  try {
    const raw = JSON.parse(trimmed) as CircleEnvelope<RawWalletList>;
    const wallets = raw.data?.wallets ?? [];
    const match = wallets.find(w => w.blockchain?.toUpperCase() === WALLET_LIST_CHAIN) ?? wallets[0];
    address = match?.address;
  } catch {
    address = trimmed.match(EVM_ADDRESS_REGEX)?.[0];
  }
  if (!address) {
    throw new Error(`circle wallet create returned no address. Raw output:\n${out}`);
  }
  return { address };
}

export async function listWallets(): Promise<AgentWallet[]> {
  const raw = await runCircleJson<CircleEnvelope<RawWalletList>>(
    ['wallet', 'list', '--chain', WALLET_LIST_CHAIN, '--type', 'agent', '--output', 'json'],
    { retries: READ_RETRIES },
  );
  const list = raw.data?.wallets ?? [];
  return list.map(w => ({ address: w.address }));
}

// Output is handed back verbatim: it differs by method, and neither shape is stable to normalise.
export async function fundWallet(input: FundWalletInput): Promise<string> {
  return runCircle([
    'wallet',
    'fund',
    '--address',
    input.address,
    '--chain',
    chainCli(input.chain ?? DEFAULT_CHAIN),
    '--method',
    input.method ?? 'crypto',
    '--output',
    'json',
  ]);
}

export async function getBalance(input: GetBalanceInput): Promise<WalletBalance> {
  const raw = await runCircleJson<CircleEnvelope<RawBalance>>(
    [
      'wallet',
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
  const rawTokens = raw.data?.balances ?? raw.data?.tokens ?? [];
  const tokens: TokenBalance[] = rawTokens.map(t => ({
    symbol: (t.token?.symbol ?? t.symbol ?? '').toUpperCase(),
    amount: t.amount ?? '0',
  }));
  return { address: raw.data?.address ?? input.address, tokens };
}

// `--no-open` makes the CLI print the URL rather than launch a browser on whatever host runs the
// dev server. Minting it moves no USDC. Mainnet only.
export async function fundWalletFiat(input: FundFiatInput): Promise<FundFiatResult> {
  const chain = input.chain ?? DEFAULT_CHAIN;
  const token: FundToken = input.token ?? 'usdc';
  const amount = String(input.amount);

  const out = await runCircle([
    'wallet',
    'fund',
    '--address',
    input.address,
    '--chain',
    chainCli(chain),
    '--amount',
    amount,
    '--token',
    token,
    '--method',
    'fiat',
    '--no-open',
    '--output',
    'json',
  ]);

  const url = extractFundUrl(out);
  if (!url) {
    throw new Error(`circle wallet fund returned no on-ramp URL. Raw output:\n${out}`);
  }
  return { address: input.address, chain, amount, token, url };
}

// The CLI nests the widget URL at `data.widgetUrl`; fall back to the first https URL in the text.
function extractFundUrl(out: string): string | undefined {
  const trimmed = out.trim();
  try {
    const env = JSON.parse(trimmed) as { data?: Record<string, unknown> };
    const url = env.data?.widgetUrl ?? env.data?.url;
    if (typeof url === 'string' && url.length > 0) return url;
  } catch {
    // fall through to regex extraction
  }
  return trimmed.match(HTTPS_URL_REGEX)?.[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Agent wallets return a Circle transaction UUID; an on-chain hash is also tolerated.
function extractTxId(out: string): string | undefined {
  const trimmed = out.trim();
  try {
    const env = JSON.parse(trimmed) as { data?: Record<string, unknown> };
    const data = env.data ?? {};
    const id = data.id ?? data.transactionId ?? data.txHash ?? data.transactionHash;
    if (typeof id === 'string') return id;
  } catch {
    // fall through to regex extraction
  }
  return trimmed.match(TX_HASH_REGEX)?.[0] ?? trimmed.match(UUID_REGEX)?.[0];
}

// Counterfactual until the first outbound transaction: `eth_getCode` returns "0x" and EIP-1271
// payment signing fails. Receiving USDC does not deploy it.
export async function isWalletDeployed(input: DeployWalletInput): Promise<boolean> {
  const res = await fetch(chainRpcUrl(input.chain ?? DEFAULT_CHAIN), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [input.address, 'latest'] }),
  });
  if (!res.ok) {
    throw new Error(`eth_getCode failed for ${input.address}: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (body.error) {
    throw new Error(`eth_getCode error for ${input.address}: ${body.error.message ?? 'unknown'}`);
  }
  const code = body.result ?? '0x';
  return code.length > 2 && code !== '0x0';
}

// Zero-value self-transfer. Idempotent, and polls until the contract is confirmed so a caller can
// pay straight afterward without a deploy/pay race.
export async function deployWallet(input: DeployWalletInput): Promise<DeployWalletResult> {
  const { address } = input;
  const chain = input.chain ?? DEFAULT_CHAIN;

  if (await isWalletDeployed({ address, chain })) {
    return { address, deployed: true, alreadyDeployed: true };
  }

  // Mutating, so retries stay at 0 and a dropped connection never double-sends.
  const out = await runCircle([
    'wallet',
    'transfer',
    address,
    '--amount',
    '0',
    '--address',
    address,
    '--chain',
    chainCli(chain),
    '--output',
    'json',
  ]);
  const txId = extractTxId(out);

  const deadline = Date.now() + DEPLOY_POLL_TIMEOUT_MS;
  let deployed = false;
  while (Date.now() < deadline) {
    await sleep(DEPLOY_POLL_INTERVAL_MS);
    if (await isWalletDeployed({ address, chain })) {
      deployed = true;
      break;
    }
  }

  return { address, deployed, alreadyDeployed: false, txId };
}

// The CLI takes the amount as a decimal string in whole USDC. `toFixed` is what keeps a small
// amount out of exponent notation: `String(1e-7)` is "1e-7", which would reach the API verbatim.
function formatUsdcAmount(amount: number | string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Transfer amount must be a positive number of USDC, got "${String(amount)}".`);
  }
  const fixed = value.toFixed(USDC_DECIMALS);
  if (Number(fixed) !== value) {
    throw new Error(
      `USDC carries ${USDC_DECIMALS} decimal places and "${String(amount)}" is finer than that. ` +
        'Round the amount and retry.',
    );
  }
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

// Send USDC from one of the agent's wallets to any address on the same chain.
//
// `--token` is always passed: `circle wallet transfer` sends the chain's *native* token when it is
// omitted, so leaving it off would send ETH or POL rather than USDC. The chain is the caller's
// choice and this does not bridge — `to` must be an address that exists on `chain`, and USDC sent
// to an address the recipient does not control on that chain is not recoverable.
//
// No deploy check: this is an outbound transaction, so it deploys the Smart Contract Account on
// the way out exactly as `deployWallet`'s zero-value self-transfer does.
//
// Mutating, so retries stay at 0 and a dropped connection never double-sends.
export async function transferUsdc(input: TransferUsdcInput): Promise<TransferUsdcResult> {
  const chain = input.chain ?? DEFAULT_CHAIN;
  const amount = formatUsdcAmount(input.amount);

  for (const [label, value] of [
    ['Source address', input.address],
    ['Destination address', input.to],
  ] as const) {
    if (!EVM_ADDRESS_EXACT.test(value)) {
      throw new Error(`${label} "${value}" is not a valid EVM address (0x followed by 40 hex characters).`);
    }
  }

  const args = [
    'wallet',
    'transfer',
    input.to,
    '--amount',
    amount,
    '--token',
    chainUsdcAddress(chain),
    '--address',
    input.address,
    '--chain',
    chainCli(chain),
    '--output',
    'json',
  ];
  if (input.idempotencyKey) args.push('--idempotency-key', input.idempotencyKey);

  const out = await runCircle(args);
  return { from: input.address, to: input.to, amount, chain, txId: extractTxId(out) };
}
