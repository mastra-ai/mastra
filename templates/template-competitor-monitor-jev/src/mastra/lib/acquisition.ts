import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';

import ipaddr from 'ipaddr.js';
import robotsParser from 'robots-parser';

import { HTTP_STATUS, SOURCE_LIMITS, TIMING } from '../config';

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type DnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type TransportResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Uint8Array;
};
export type PinnedTransport = (request: {
  url: URL;
  hostname: string;
  address: ResolvedAddress;
  timeoutMs: number;
  abortSignal?: AbortSignal;
}) => Promise<TransportResponse>;
export type AcquiredPage = {
  url: string;
  status: number;
  html: string;
  contentType: string;
  retries: number;
  durationMs: number;
};

export class AcquisitionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
  ) {
    super(code);
  }
}

const blockedRanges = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'private',
  'uniqueLocal',
]);

export function isPublicAddress(value: string) {
  try {
    const parsed = ipaddr.process(value);
    const range = parsed.range();
    if (range !== 'unicast' || blockedRanges.has(range)) return false;
    // Treat transition/tunnel prefixes conservatively. A public-looking IPv6 literal
    // can otherwise carry a private IPv4 destination through NAT64, 6to4 or Teredo.
    if (parsed.kind() === 'ipv6') {
      if (
        parsed.match(ipaddr.parse('64:ff9b::'), 96) ||
        parsed.match(ipaddr.parse('64:ff9b:1::'), 48) ||
        parsed.match(ipaddr.parse('2002::'), 16) ||
        parsed.match(ipaddr.parse('2001::'), 32)
      ) {
        return false;
      }
    }
    if (parsed.kind() === 'ipv4') {
      const octets = (parsed as ipaddr.IPv4).octets;
      const first = octets[0]!;
      const second = octets[1]!;
      if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
      if (first === 100 && second >= 64 && second <= 127) return false;
      if (first === 169 && second === 254) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && second === 168) return false;
      if (first === 198 && (second === 18 || second === 19 || second === 51)) return false;
      if (first === 203 && second === 0 && octets[2] === 113) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const systemResolver: DnsResolver = async hostname => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map(record => ({ address: record.address, family: record.family as 4 | 6 }));
};

function header(response: TransportResponse, name: string) {
  const value = response.headers[name.toLowerCase()] ?? response.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function retryAfterDelay(value: string | undefined, now = Date.now()) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function validPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new AcquisitionError('UNSAFE_URL_SCHEME');
  if (url.username || url.password) throw new AcquisitionError('UNSAFE_URL_CREDENTIALS');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) throw new AcquisitionError('UNSAFE_ADDRESS');
  const literalAddress = url.hostname.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(literalAddress) && !isPublicAddress(literalAddress)) throw new AcquisitionError('UNSAFE_ADDRESS');
}

async function resolvePinned(url: URL, resolver: DnsResolver) {
  validPublicUrl(url);
  let timer: NodeJS.Timeout | undefined;
  try {
    const addresses = await Promise.race([
      resolver(url.hostname),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AcquisitionError('DNS_TIMEOUT', true)), TIMING.httpAttemptMs);
      }),
    ]);
    if (!addresses.length || addresses.some(address => !isPublicAddress(address.address)))
      throw new AcquisitionError('UNSAFE_ADDRESS');
    return addresses[0]!;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const nodePinnedTransport: PinnedTransport = ({ url, hostname, address, timeoutMs, abortSignal }) =>
  new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(
      url,
      {
        // Connect through the validated address, while preserving the URL host for HTTP and TLS.
        headers: { Accept: 'text/html,application/xhtml+xml', Host: url.host },
        lookup: (_host, options, callback) => {
          // Node's family autoselection requests all addresses; never resolve the host again.
          if (options.all) callback(null, [{ address: address.address, family: address.family }]);
          else callback(null, address.address, address.family);
        },
        servername: hostname,
      },
      response => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on('data', chunk => {
          received += chunk.length;
          if (received > SOURCE_LIMITS.maxHtmlBytes) {
            request.destroy(new AcquisitionError('RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        response.on('end', () => {
          clearTimeout(deadline);
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
        });
      },
    );
    const onAbort = () => request.destroy(new AcquisitionError('ACQUISITION_CANCELED'));
    const cleanupAbort = () => abortSignal?.removeEventListener('abort', onAbort);
    const deadline = setTimeout(() => request.destroy(new AcquisitionError('HTTP_TIMEOUT', true)), timeoutMs);
    request.setTimeout(timeoutMs, () => request.destroy(new AcquisitionError('HTTP_TIMEOUT', true)));
    if (abortSignal?.aborted) onAbort();
    else abortSignal?.addEventListener('abort', onAbort, { once: true });
    request.once('error', error => {
      clearTimeout(deadline);
      cleanupAbort();
      reject(error);
    });
    request.once('close', cleanupAbort);
    request.end();
  });

export async function fetchPublicPage(
  value: string,
  options: {
    resolver?: DnsResolver;
    transport?: PinnedTransport;
    acceptedContentTypes?: RegExp;
    abortSignal?: AbortSignal;
    beforeRequest?: (url: URL) => Promise<void>;
  } = {},
): Promise<AcquiredPage> {
  const resolver = options.resolver ?? systemResolver;
  const transport = options.transport ?? nodePinnedTransport;
  const initialUrl = new URL(value);
  validPublicUrl(initialUrl);
  const allowedHost = initialUrl.hostname.toLowerCase();
  const startedAt = Date.now();
  let url = initialUrl;
  let retries = 0;

  let redirects = 0;
  while (redirects <= SOURCE_LIMITS.maxRedirects) {
    if (options.abortSignal?.aborted) throw new AcquisitionError('ACQUISITION_CANCELED');
    if (Date.now() - startedAt > TIMING.acquisitionDeadlineMs) throw new AcquisitionError('ACQUISITION_TIMEOUT', true);
    if (url.hostname.toLowerCase() !== allowedHost) throw new AcquisitionError('UNSAFE_REDIRECT_HOST');
    const address = await resolvePinned(url, resolver);
    await options.beforeRequest?.(url);
    if (options.abortSignal?.aborted) throw new AcquisitionError('ACQUISITION_CANCELED');
    let response: TransportResponse;
    try {
      response = await transport({
        url,
        hostname: url.hostname,
        address,
        timeoutMs: TIMING.httpAttemptMs,
        abortSignal: options.abortSignal,
      });
    } catch (error) {
      if (options.abortSignal?.aborted) throw new AcquisitionError('ACQUISITION_CANCELED');
      if (retries >= TIMING.maxRetries || (error instanceof AcquisitionError && !error.retryable)) throw error;
      retries += 1;
      const wait = Math.min(
        TIMING.retryInitialDelayMs * TIMING.retryBackoffFactor ** (retries - 1),
        TIMING.retryMaxDelayMs,
      );
      if (Date.now() - startedAt + wait > TIMING.acquisitionDeadlineMs)
        throw new AcquisitionError('ACQUISITION_TIMEOUT', true);
      await new Promise(resolve => setTimeout(resolve, wait));
      continue;
    }
    if (options.abortSignal?.aborted) throw new AcquisitionError('ACQUISITION_CANCELED');
    if ((HTTP_STATUS.redirects as readonly number[]).includes(response.status)) {
      const location = header(response, 'location');
      if (!location) throw new AcquisitionError('REDIRECT_WITHOUT_LOCATION');
      url = new URL(location, url);
      redirects += 1;
      continue;
    }
    if (response.status === HTTP_STATUS.tooManyRequests || response.status >= HTTP_STATUS.serverErrorMin) {
      if (retries >= TIMING.maxRetries) throw new AcquisitionError(`HTTP_${response.status}`, true);
      const retryAfter = retryAfterDelay(header(response, 'retry-after'));
      const wait =
        retryAfter !== undefined
          ? retryAfter
          : Math.min(TIMING.retryInitialDelayMs * TIMING.retryBackoffFactor ** retries, TIMING.retryMaxDelayMs);
      if (wait > TIMING.retryMaxDelayMs || Date.now() - startedAt + wait > TIMING.acquisitionDeadlineMs) {
        throw new AcquisitionError('RETRY_DEFERRED', true);
      }
      retries += 1;
      await new Promise(resolve => setTimeout(resolve, wait));
      continue;
    }
    if (response.status < HTTP_STATUS.successMin || response.status >= HTTP_STATUS.successMaxExclusive) {
      throw new AcquisitionError(`HTTP_${response.status}`);
    }
    const contentType = (header(response, 'content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const acceptedContentTypes = options.acceptedContentTypes ?? /^(?:text\/html|application\/xhtml\+xml)$/i;
    if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType))
      throw new AcquisitionError('INVALID_CONTENT_TYPE');
    if (!acceptedContentTypes.test(contentType)) throw new AcquisitionError('INVALID_CONTENT_TYPE');
    if (response.body.byteLength > SOURCE_LIMITS.maxHtmlBytes) throw new AcquisitionError('RESPONSE_TOO_LARGE');
    const html = new TextDecoder().decode(response.body);
    if (!html.trim()) throw new AcquisitionError('EMPTY_RESPONSE');
    return {
      url: url.toString(),
      status: response.status,
      html,
      contentType,
      retries,
      durationMs: Date.now() - startedAt,
    };
  }
  throw new AcquisitionError('TOO_MANY_REDIRECTS');
}

export async function assertRobotsAllowed(
  pageUrl: string,
  options: { resolver?: DnsResolver; transport?: PinnedTransport; abortSignal?: AbortSignal } = {},
) {
  const url = new URL(pageUrl);
  const robotsUrl = new URL('/robots.txt', url).toString();
  try {
    const robots = await fetchPublicPage(robotsUrl, { ...options, acceptedContentTypes: /^text\/plain$/i });
    const parser = robotsParser(robots.url, robots.html);
    if (!parser.isAllowed(pageUrl, 'competitor-monitor-jev')) throw new AcquisitionError('ROBOTS_DENIED');
  } catch (error) {
    if (error instanceof AcquisitionError && error.code === `HTTP_${HTTP_STATUS.notFound}`) return;
    throw error;
  }
}
