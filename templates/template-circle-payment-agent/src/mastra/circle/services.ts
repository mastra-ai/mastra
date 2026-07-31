// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { runCircle, runCircleJson } from './cli';
import { getBalance } from './wallet';
import { CHAIN_PREFERENCE, chainCli, chainFromNetwork, chainLabel, DEFAULT_CHAIN, type Chain } from './chains';
import type {
  AcceptOption,
  FetchServiceResult,
  PaymentResult,
  Service,
  ServiceAccepts,
  ServiceInspection,
} from './types';
import { bindUrl, findPathPlaceholders, unfilledPlaceholderMessage } from './paths';
import {
  buildResponseVocab,
  declaredQueryParams,
  findFieldViolations,
  preSpendErrorMessage,
  requestSchemaShape,
} from './validate';

const TX_HASH_REGEX = /0x[a-fA-F0-9]{64}/;
// The CLI defaults to 30s, too tight for slower endpoints, and a timeout still spends USDC.
const PAY_TIMEOUT_SECONDS = 60;
const READ_RETRIES = 3;
const USDC_DECIMALS = 6;

// HTTP methods that carry a request body. GET and DELETE take their input as query parameters.
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export interface SearchServicesInput {
  keyword: string;
}

export interface InspectServiceInput {
  url: string;
}

export interface FetchServiceInput {
  url: string;
}

export interface PayServiceInput {
  url: string;
  address: string;
  data: Record<string, unknown>;
  // Defaults to GET. GET/DELETE send `data` as query parameters, POST/PUT/PATCH as a JSON body.
  method?: string;
  // Must be a chain the seller offers. Defaults to Base.
  chain?: Chain;
}

// Every field is optional so a CLI shape change degrades gracefully instead of throwing.
interface RawSearchItem {
  resource?: string;
  accepts?: Array<{ amount?: string; network?: string }>;
  metadata?: {
    provider?: { name?: string; description?: string };
    description?: string;
    path?: string;
    method?: string;
  };
}

interface RawInspection {
  url?: string;
  status?: string;
  httpStatus?: number;
  description?: string;
  provider?: { name?: string; description?: string; openApiUrl?: string; docsUrl?: string };
  price?: { amount?: string; formatted?: string };
  input?: unknown;
  method?: string;
}

function atomicToUsdc(atomic: string | undefined): number | undefined {
  if (!atomic) return undefined;
  const n = Number(atomic);
  return Number.isFinite(n) ? n / 10 ** USDC_DECIMALS : undefined;
}

function formatUsdc(atomic: string | undefined): string | undefined {
  const n = atomicToUsdc(atomic);
  return n === undefined ? undefined : `${n} USDC`;
}

// The CLI wraps results as `{ data: { items } }`; a bare `{ items }` is tolerated too.
function extractSearchItems(raw: unknown): RawSearchItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const data = o.data as Record<string, unknown> | undefined;
  if (data && Array.isArray(data.items)) return data.items as RawSearchItem[];
  if (Array.isArray(o.items)) return o.items as RawSearchItem[];
  return [];
}

// Quoting `accepts[0]` misprices any listing whose first option is a network we cannot pay.
function preferredAccept(
  accepts: Array<{ amount?: string; network?: string }> | undefined,
): { amount?: string; chain: Chain } | null {
  if (!accepts?.length) return null;
  for (const chain of CHAIN_PREFERENCE) {
    const match = accepts.find(a => a.network && chainFromNetwork(a.network) === chain);
    if (match) return { amount: match.amount, chain };
  }
  return null;
}

function mapSearchItem(item: RawSearchItem): Service {
  const meta = item.metadata ?? {};
  const provider = meta.provider ?? {};
  const accept = preferredAccept(item.accepts);
  return {
    url: item.resource ?? '',
    name: provider.name ?? meta.path ?? item.resource ?? 'unknown service',
    description: meta.description ?? provider.description,
    price: formatUsdc(accept?.amount),
    chain: accept?.chain,
    method: meta.method ? meta.method.toUpperCase() : undefined,
  };
}

function unwrapData(raw: unknown): RawInspection {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (o.data && typeof o.data === 'object') return o.data as RawInspection;
  return o as RawInspection;
}

export async function searchServices(input: SearchServicesInput): Promise<Service[]> {
  const raw = await runCircleJson<unknown>(['services', 'search', input.keyword, '--output', 'json'], {
    retries: READ_RETRIES,
  });
  return extractSearchItems(raw).map(mapSearchItem);
}

export async function inspectService(input: InspectServiceInput): Promise<ServiceInspection> {
  const raw = await runCircleJson<unknown>(['services', 'inspect', input.url, '--output', 'json'], {
    retries: READ_RETRIES,
  });
  const data = unwrapData(raw);
  const provider = data.provider ?? {};
  return {
    url: data.url ?? input.url,
    name: provider.name ?? data.description ?? data.url ?? input.url,
    description: data.description ?? provider.description,
    price: data.price?.formatted ?? formatUsdc(data.price?.amount),
    priceUsdc: atomicToUsdc(data.price?.amount),
    schema: data.input,
    health: data.status,
    httpStatus: typeof data.httpStatus === 'number' ? data.httpStatus : undefined,
    method: data.method ? data.method.toUpperCase() : undefined,
    openApiUrl: provider.openApiUrl,
    docsUrl: provider.docsUrl,
  };
}

// Unpaid GET. A paid resource answers 402 with a challenge; a free one answers 200 with data.
export async function fetchService(input: FetchServiceInput): Promise<FetchServiceResult> {
  let res: Response;
  try {
    res = await fetch(input.url, { method: 'GET' });
  } catch (e) {
    throw new Error(`Could not reach ${input.url}: ${(e as Error).message}`);
  }
  const contentType = res.headers.get('content-type') ?? undefined;
  const raw = await res.text();
  let body = raw;
  if (contentType?.includes('application/json')) {
    try {
      body = JSON.stringify(JSON.parse(raw));
    } catch {
      // Header claims JSON but the body is not, so return the raw text.
    }
  }
  return { url: input.url, status: res.status, paymentRequired: res.status === 402, contentType, body };
}

interface Raw402Accept {
  network?: string;
  amount?: string;
  extra?: { name?: string };
}

function decodeBase64Json(value: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(value, 'base64').toString('utf8');
    const obj = JSON.parse(json) as unknown;
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// The challenge is a JSON body in x402 v1 and a base64 `payment-required` header in v2. A v2
// seller sends an empty body, so a body-only reader wrongly rejects a payable service.
async function readAccepts(res: Response): Promise<Raw402Accept[] | null> {
  const header = res.headers.get('payment-required');
  if (header) {
    const decoded = decodeBase64Json(header.trim());
    if (decoded && Array.isArray(decoded.accepts)) return decoded.accepts as Raw402Accept[];
  }
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return null;
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { accepts?: unknown }).accepts)) {
    return (parsed as { accepts: Raw402Accept[] }).accepts;
  }
  return null;
}

// Gateway is identified by `extra.name === 'GatewayWalletBatched'`, not `scheme`, which reads
// `exact` for both.
export async function getServiceAccepts(url: string, method = 'GET'): Promise<ServiceAccepts> {
  // Probe with the method the payment will use: a POST-only endpoint answers 405, not 402, to GET.
  const probeMethod = method.toUpperCase();
  // A seller that parses the body before its x402 middleware answers 400/422 to a bodyless POST,
  // which reads as "no challenge". An empty object survives that and is never charged.
  const probeInit: RequestInit = BODY_METHODS.has(probeMethod)
    ? { method: probeMethod, headers: { 'content-type': 'application/json' }, body: '{}' }
    : { method: probeMethod };
  let res: Response;
  try {
    res = await fetch(url, probeInit);
  } catch (e) {
    throw new Error(`Could not reach ${url} to read its x402 payment options: ${(e as Error).message}`);
  }
  const accepts = await readAccepts(res);
  if (accepts === null) {
    // A 2xx is a free endpoint that should be read rather than paid; a non-2xx is usually a
    // wrong-method probe that missed the challenge.
    if (res.ok) {
      throw new Error(
        `${url} returned data without requiring payment (HTTP ${res.status}), so it is a free ` +
          'endpoint, not a paid x402 resource. Read it with fetch-service instead of circle-pay-service.',
      );
    }
    throw new Error(
      `${url} did not return an x402 challenge to a ${probeMethod} request (HTTP ${res.status}). ` +
        'If the service expects a different HTTP method, pass the `method` from ' +
        'circle-inspect-service so the payment options are read with that method.',
    );
  }
  if (accepts.length === 0) {
    throw new Error(
      `${url} published no x402 payment options, so it is not a paid x402 resource. ` +
        'If it is a free endpoint, read it with fetch-service instead of circle-pay-service.',
    );
  }
  const options: AcceptOption[] = [];
  const unsupported = new Set<string>();
  for (const a of accepts) {
    const network = a.network ?? '';
    const chain = network ? chainFromNetwork(network) : null;
    if (!chain) {
      if (network) unsupported.add(network);
      continue;
    }
    options.push({
      kind: a.extra?.name === 'GatewayWalletBatched' ? 'gateway' : 'vanilla',
      chain,
      amountAtomic: a.amount ?? '',
    });
  }
  return { url, options, unsupportedNetworks: [...unsupported] };
}

export function preferredChain(accepts: ServiceAccepts): Chain | null {
  for (const chain of CHAIN_PREFERENCE) {
    if (accepts.options.some(o => o.chain === chain)) return chain;
  }
  return null;
}

async function usdcOn(address: string, chain: Chain): Promise<number | null> {
  try {
    const balance = await getBalance({ address, chain });
    const usdc = balance.tokens.find(t => t.symbol === 'USDC')?.amount;
    const n = Number(usdc ?? '0');
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function priceOn(accepts: ServiceAccepts, chain: Chain): number | null {
  const amounts = accepts.options
    .filter(o => o.chain === chain)
    .map(o => atomicToUsdc(o.amountAtomic))
    .filter((n): n is number => n !== undefined);
  return amounts.length ? Math.min(...amounts) : null;
}

// `preferredChain` knows only what the seller offers, so a Polygon-funded wallet would be sent to
// Base and fail for want of funds. Falls back to it when nothing is affordable, leaving the price
// guard to report the shortfall against a real chain.
export async function chooseChain(accepts: ServiceAccepts, address: string): Promise<Chain | null> {
  const offered = CHAIN_PREFERENCE.filter(c => accepts.options.some(o => o.chain === c));
  if (offered.length <= 1) return offered[0] ?? null;
  for (const chain of offered) {
    const [balance, price] = await Promise.all([usdcOn(address, chain), Promise.resolve(priceOn(accepts, chain))]);
    if (balance !== null && price !== null && balance >= price) return chain;
  }
  return preferredChain(accepts);
}

// The CLI auto-routes to Gateway whenever the seller advertises it, so one option is enough.
export function sellerRequiresGateway(accepts: ServiceAccepts, chain: Chain): boolean {
  return accepts.options.some(o => o.chain === chain && o.kind === 'gateway');
}

// Payment submitted but the request failed afterwards: non-refundable, and never retryable.
const PAYMENT_SUBMITTED_PATTERNS = [
  'payment submitted',
  'payment was submitted',
  'payment may have been submitted',
  'funds may have moved',
];

function paymentAlreadySubmitted(detail: string): boolean {
  return PAYMENT_SUBMITTED_PATTERNS.some(p => detail.includes(p));
}

// Transport failures proving the CLI never reached the seller, so nothing was spent.
const NEVER_CONNECTED_PATTERNS = ['enotfound', 'econnrefused', 'eai_again', 'getaddrinfo'];

// Ambiguous by construction: the CLI connects both to fetch the challenge and to pay, and the
// text says nothing about which broke, so treat as charged.
const CONNECTION_LOST_PATTERNS = [
  'terminated',
  'socket hang up',
  'econnreset',
  'etimedout',
  'timed out',
  'aborted',
  'headers timeout',
  'body timeout',
  'fetch failed',
];

function transportFailure(detail: string): 'never-connected' | 'connection-lost' | null {
  if (NEVER_CONNECTED_PATTERNS.some(p => detail.includes(p))) return 'never-connected';
  if (CONNECTION_LOST_PATTERNS.some(p => detail.includes(p))) return 'connection-lost';
  return null;
}

function explainPayError(e: unknown, url: string): Error {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();
  // The CLI auto-routes to Gateway whenever a seller advertises it, with no flag to force vanilla.
  if (lower.includes('no gateway balance found') || lower.includes('insufficient gateway balance')) {
    return new Error(
      'This seller requires a Circle Gateway (batched) payment and the wallet has no ' +
        'Gateway balance on the chain the seller settles on. Call circle-gateway-deposit for ' +
        `this service URL, then retry the payment.\n\nUnderlying CLI error: ${message}`,
    );
  }
  if (paymentAlreadySubmitted(lower)) {
    return new Error(
      `The USDC payment for ${url} was already submitted and has been spent, but the ` +
        'request failed afterwards (the server rejected it or it timed out). This is ' +
        'NOT a payload problem you can fix by retrying: x402 charges before the request ' +
        'resolves, so re-paying this URL just spends more USDC for the same failure. ' +
        "Do not pay this URL again. The service's published input schema may be " +
        'inaccurate, or the endpoint may be unhealthy. Choose a different service, or ' +
        `report this one as broken.\n\nUnderlying CLI error: ${message}`,
    );
  }
  switch (transportFailure(lower)) {
    case 'never-connected':
      return new Error(
        `Could not reach ${url} at all: the connection was never established, so no request ` +
          'was sent and NO PAYMENT WAS MADE. The host may be down or the URL wrong. Retrying ' +
          'is safe; if it fails the same way again, choose a different service.\n\n' +
          `Underlying CLI error: ${message}`,
      );
    case 'connection-lost':
      return new Error(
        `The connection to ${url} broke mid-request (the response ended early, or the ` +
          `${PAY_TIMEOUT_SECONDS}s deadline aborted it). TREAT THIS AS ALREADY PAID: x402 ` +
          'submits the USDC before the upstream request resolves, so the payment may well ' +
          'have settled with the response lost on the way back. Do NOT retry this URL to ' +
          'find out — that risks a second charge for the same call. Report the failure, ' +
          'and note the wallet balance may have decreased. If the data is still needed, ' +
          'either ask for a narrower request (a smaller limit or page size answers faster ' +
          'and is less likely to time out) or use a different service.\n\n' +
          `Underlying CLI error: ${message}`,
      );
    default:
      return e instanceof Error ? e : new Error(message);
  }
}

// A bare 64-hex hash wins; failing that, settle receipts are base64 JSON, so decode and look.
function extractTxHash(source: string | undefined): string | undefined {
  if (!source) return undefined;
  const direct = source.match(TX_HASH_REGEX)?.[0];
  if (direct) return direct;
  try {
    const decoded = Buffer.from(source, 'base64').toString('utf8');
    return decoded.match(TX_HASH_REGEX)?.[0];
  } catch {
    return undefined;
  }
}

interface RawPayEnvelope {
  response?: unknown;
  payment?: { amount?: string; receipt?: string };
}

// `health` values meaning the marketplace could not get a payable answer out of the endpoint.
const DEAD_HEALTH = new Set(['down', 'offline', 'unreachable', 'unhealthy', 'error', 'unpayable']);

// Refuse a service already observed to be broken. Only positively-bad signals block.
function assertServiceHealthy(url: string, inspection: ServiceInspection | null): void {
  if (!inspection) return;
  const health = inspection.health?.toLowerCase();
  const dead = (health && DEAD_HEALTH.has(health)) || (inspection.httpStatus ?? 0) >= 500;
  if (!dead) return;
  const detail = [
    health ? `status \`${inspection.health}\`` : null,
    inspection.httpStatus ? `last probe returned HTTP ${inspection.httpStatus}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  throw new Error(
    `Not paying ${url}: the marketplace reports this service as not working (${detail}). ` +
      'x402 charges before the upstream request resolves, so paying a service that is down ' +
      'buys an error. NO PAYMENT WAS MADE. Choose a different service.',
  );
}

// Refuse to pay when the wallet cannot cover the price. An unknown price or balance proceeds.
async function assertCanAfford(
  input: PayServiceInput,
  chain: Chain,
  inspection: ServiceInspection | null,
): Promise<void> {
  const price = inspection?.priceUsdc;
  if (price === undefined || !Number.isFinite(price)) return;
  const balance = await usdcOn(input.address, chain);
  if (balance === null || balance >= price) return;
  throw new Error(
    `Not paying ${input.url}: it costs ${price} USDC but wallet ${input.address} holds only ` +
      `${balance} USDC on ${chainLabel(chain)}. NO PAYMENT WAS MADE. Fund the wallet on ` +
      `${chainLabel(chain)} (circle-wallet-fund on testnet, or circle-fund-fiat) and retry, ` +
      'or use a wallet that already holds enough there.',
  );
}

// Checked against the seller's published enums and OpenAPI response fields. Fails open: only a
// proven violation stops a payment.
async function assertPayloadValid(
  input: PayServiceInput,
  method: string,
  inspection: ServiceInspection | null,
): Promise<void> {
  if (!inspection) return;
  const shape = requestSchemaShape(inspection.schema);
  if (!shape) return;
  let vocab: Set<string> | null = null;
  try {
    vocab = await buildResponseVocab(inspection.openApiUrl, input.url, method);
  } catch {
    vocab = null;
  }
  const problems = findFieldViolations(input.data, { ...shape, vocab });
  if (problems.length) {
    throw new Error(preSpendErrorMessage(input.url, problems));
  }
}

// `--output json` is required: the default table output omits the tx hash, so a hash-presence check
// would fail on every successful payment and re-pay in a loop. Success is the CLI exit code.
export async function payService(input: PayServiceInput): Promise<PaymentResult> {
  const method = (input.method ?? 'GET').toUpperCase();
  // Read the published contract once. A failure here means "unknown", which every guard below
  // treats as permission to proceed.
  let inspection: ServiceInspection | null = null;
  try {
    inspection = await inspectService({ url: input.url });
  } catch {
    inspection = null;
  }

  // Every guard runs before the CLI is invoked, so each one that fires costs nothing.
  assertServiceHealthy(input.url, inspection);
  await assertCanAfford(input, input.chain ?? DEFAULT_CHAIN, inspection);
  await assertPayloadValid(input, method, inspection);

  const sendsBody = BODY_METHODS.has(method);
  // The payload goes to the probe too: a placeholder renamed after one of the call's own fields
  // reads as a filled segment without it, and would be paid for.
  const placeholders = await findPathPlaceholders(input.url, method, input.data);
  const declaredQuery = declaredQueryParams(inspection?.schema);
  // A body method still needs its path bound, so only path-eligible fields reach the binder.
  const bindable = sendsBody
    ? Object.fromEntries(
        Object.entries(input.data).filter(([k]) => placeholders.some(p => p.name.toLowerCase() === k.toLowerCase())),
      )
    : input.data;
  const bound = bindUrl(input.url, bindable, placeholders, declaredQuery);
  if (bound.unfilled.length) {
    throw new Error(unfilledPlaceholderMessage(input.url, bound.unfilled, input.data));
  }
  const url = bound.url;
  // Fields consumed by the path must not be repeated in the body.
  const body = sendsBody
    ? Object.fromEntries(Object.entries(input.data).filter(([k]) => !bound.boundKeys.includes(k)))
    : null;
  const args = [
    'services',
    'pay',
    url,
    '--address',
    input.address,
    '--chain',
    chainCli(input.chain ?? DEFAULT_CHAIN),
    '--method',
    method,
    '--timeout',
    String(PAY_TIMEOUT_SECONDS),
    '--output',
    'json',
  ];
  if (body) {
    args.push('--data', JSON.stringify(body));
  }

  let out: string;
  try {
    out = await runCircle(args);
  } catch (e) {
    throw explainPayError(e, input.url);
  }

  // The call settled the moment runCircle returned; from here we only shape the body.
  const trimmed = out.trim();
  let envelope: RawPayEnvelope;
  try {
    envelope = JSON.parse(trimmed) as RawPayEnvelope;
  } catch {
    return { response: trimmed, txHash: extractTxHash(trimmed), serviceUrl: input.url, amount: '' };
  }

  const response =
    envelope.response === undefined
      ? trimmed
      : typeof envelope.response === 'string'
        ? envelope.response
        : JSON.stringify(envelope.response);

  return {
    response,
    txHash: extractTxHash(envelope.payment?.receipt) ?? extractTxHash(trimmed),
    serviceUrl: input.url,
    amount: envelope.payment?.amount ?? '',
  };
}
