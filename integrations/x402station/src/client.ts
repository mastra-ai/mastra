import { ExactEvmScheme } from '@x402/evm';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import type { LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { PaymentReceipt } from './types.js';

const DEFAULT_BASE_URL = 'https://x402station.io';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Validates the configured base URL points at the canonical x402station
 * host (or a local-dev URL on `localhost` / `127.0.0.1` / `[::1]`). Any
 * other host throws so a misconfigured agent can't be tricked into
 * signing x402 payments against an attacker-controlled URL. Mirrors the
 * allow-list shipped in the official `x402station-mcp` npm package.
 *
 * - `u.host` (NOT `u.hostname`) — `https://x402station.io:9999`.hostname
 *   strips the port, but `.host` keeps it. Without this a non-default
 *   port silently bypasses the canonical check.
 * - `[::1]` (IPv6 loopback) — included so dual-stack dev machines that
 *   bind their oracle to `::1` work. URL parsing returns it as the
 *   bracketed form `[::1]:3002`, which the `startsWith` check matches.
 */
function resolveBaseUrl(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`@mastra/x402station: baseUrl is not a valid URL: ${value}`);
  }
  const isCanonical = u.host === 'x402station.io' && u.protocol === 'https:';
  const isLocalDev =
    (u.host.startsWith('localhost') || u.host.startsWith('127.0.0.1') || u.host.startsWith('[::1]')) &&
    (u.protocol === 'http:' || u.protocol === 'https:');
  if (!isCanonical && !isLocalDev) {
    throw new Error(
      `@mastra/x402station: baseUrl must be https://x402station.io or a localhost dev URL; got "${value}". ` +
        'Refusing to sign x402 payments against an unknown host.',
    );
  }
  return value;
}

/**
 * Decodes the settled-payment receipt header. When the header is present
 * but the body fails decode (non-base64, non-JSON, or a stripped proxy
 * mangled it), returns `{ raw, malformed: true }` so spend-auditing code
 * can branch on `malformed` rather than silently consuming a stub
 * object.
 */
function decodeReceipt(headers: Headers): PaymentReceipt | null {
  const raw = headers.get('x-payment-response') ?? headers.get('payment-response');
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw)) as PaymentReceipt;
  } catch {
    return { raw, malformed: true };
  }
}

function resolveAccount(config: X402StationClientOptions): LocalAccount {
  if (config.account) return config.account;
  const pk = config.privateKey ?? process.env.X402STATION_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      '@mastra/x402station: a viem `account` (or `privateKey` / X402STATION_PRIVATE_KEY env var) is required. ' +
        'x402station charges $0.001–$0.01 USDC per call via x402; the client needs a wallet to sign 402 challenges. ' +
        'Provide a Base mainnet account holding USDC at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.',
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error('@mastra/x402station: privateKey is malformed — expected 0x + 64 hex chars.');
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

export interface X402StationClientOptions {
  /**
   * Pre-built viem `LocalAccount` that signs EIP-712 X-PAYMENT
   * challenges. Mutually exclusive with `privateKey`. If neither is
   * provided, `X402STATION_PRIVATE_KEY` is read from the environment.
   */
  account?: LocalAccount;
  /** 0x-prefixed 64-hex private key. Convenience over `account`. */
  privateKey?: string;
  /**
   * Override base URL. Only `https://x402station.io` (canonical) or
   * `http(s)://localhost` / `127.0.0.1` / `[::1]` (dev) are accepted.
   */
  baseUrl?: string;
  /** Custom fetch (mostly for tests). Default: global `fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * Per-call timeout in ms. Aborts the underlying fetch if the oracle
   * takes longer — without it a stalled network turns into a stuck
   * agent step. Default: 30 000.
   */
  timeoutMs?: number;
}

export interface X402StationClient {
  baseUrl: string;
  timeoutMs: number;
  /**
   * POST a paid x402 endpoint. Wraps fetch with `@x402/fetch` so the
   * 402 challenge is auto-signed and retried. Returns the parsed JSON
   * body plus the decoded payment receipt (or `null` if the receipt
   * header is missing).
   */
  callPaid<T = unknown>(path: string, body: unknown): Promise<{ result: T; paymentReceipt: PaymentReceipt | null }>;
  /**
   * Issue a free, secret-gated request (used for `watch.status` and
   * `watch.unsubscribe`). The secret travels in the
   * `x-x402station-secret` header.
   */
  callFree<T = unknown>(path: string, method: 'GET' | 'DELETE', secret: string): Promise<T>;
}

/**
 * Build a configured x402station client. Tools defer this call until
 * first execution so importing `@mastra/x402station` doesn't fail when
 * an account hasn't been wired up yet.
 */
export function getX402StationClient(config: X402StationClientOptions = {}): X402StationClient {
  const baseUrl = resolveBaseUrl(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFree = (config.fetchImpl ?? globalThis.fetch).bind(globalThis);

  let cachedPaid: typeof fetch | null = null;
  function getFetchPaid(): typeof fetch {
    if (cachedPaid) return cachedPaid;
    const account = resolveAccount(config);
    const scheme = new ExactEvmScheme(account);
    cachedPaid = wrapFetchWithPaymentFromConfig(config.fetchImpl ?? globalThis.fetch, {
      schemes: [
        { network: 'eip155:8453', client: scheme }, // Base mainnet
        { network: 'eip155:84532', client: scheme }, // Base Sepolia
      ],
    });
    return cachedPaid;
  }

  async function callPaid<T>(path: string, body: unknown): Promise<{ result: T; paymentReceipt: PaymentReceipt | null }> {
    const f = getFetchPaid();
    let res: Response;
    try {
      res = await f(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const e = err as { name?: string };
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        throw new Error(`@mastra/x402station: ${path} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
    const paymentReceipt = decodeReceipt(res.headers);
    const raw = await res.text();
    if (!res.ok) {
      const snippet = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
      throw new Error(`@mastra/x402station: ${path} returned ${res.status}: ${snippet}`);
    }
    let result: T;
    try {
      result = JSON.parse(raw) as T;
    } catch {
      throw new Error(
        `@mastra/x402station: ${path} returned 200 with non-JSON body (first 200 chars): ${raw.slice(0, 200)}`,
      );
    }
    return { result, paymentReceipt };
  }

  async function callFree<T>(path: string, method: 'GET' | 'DELETE', secret: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchFree(`${baseUrl}${path}`, {
        method,
        headers: { 'x-x402station-secret': secret },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const e = err as { name?: string };
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        throw new Error(`@mastra/x402station: ${method} ${path} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
    const raw = await res.text();
    if (!res.ok) {
      const snippet = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
      throw new Error(`@mastra/x402station: ${method} ${path} returned ${res.status}: ${snippet}`);
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        `@mastra/x402station: ${method} ${path} returned 200 with non-JSON body (first 200 chars): ${raw.slice(0, 200)}`,
      );
    }
  }

  return { baseUrl, timeoutMs, callPaid, callFree };
}
