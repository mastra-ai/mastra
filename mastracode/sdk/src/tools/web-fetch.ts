import { lookup as defaultLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_WEB_FETCH_TOKENS = 8_000;
const REQUEST_TIMEOUT_MS = 15_000;

interface ValidatedDestination {
  originalUrl: URL;
  address: string;
  family: number;
  servername?: string;
}

interface TransportResponse {
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Uint8Array>;
  dispose: () => void;
}

interface WebFetchDependencies {
  lookup?: typeof defaultLookup;
  transport?: (destination: ValidatedDestination) => Promise<TransportResponse>;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function isDisallowedHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    !hostname.includes('.')
  );
}

function isDisallowedIpv4(address: string): boolean {
  const [first = -1, second = -1, third = -1] = address.split('.').map(Number);

  return (
    first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isDisallowedIpv6(address: string): boolean {
  const normalized = normalizeHostname(address);
  if (normalized.includes('%') || normalized.startsWith('::ffff:')) return true;

  const firstHextet = Number.parseInt(normalized.split(':')[0] ?? '', 16);
  const isGlobalUnicast = firstHextet >= 0x2000 && firstHextet <= 0x3fff;
  return !isGlobalUnicast || normalized.startsWith('2001:db8:');
}

function isDisallowedIpAddress(address: string): boolean {
  const version = isIP(normalizeHostname(address));
  if (version === 4) return isDisallowedIpv4(address);
  if (version === 6) return isDisallowedIpv6(address);
  return true;
}

async function resolveValidatedDestination(
  rawUrl: string,
  lookup: typeof defaultLookup = defaultLookup,
): Promise<ValidatedDestination> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`web_fetch only supports public http or https URLs, received ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('web_fetch does not allow credentials in URLs');
  }

  const hostname = normalizeHostname(url.hostname);
  if (isDisallowedHostname(hostname) || (isIP(hostname) !== 0 && isDisallowedIpAddress(hostname))) {
    throw new Error(`web_fetch blocked a local, private, or reserved destination: ${hostname}`);
  }

  const resolvedAddresses =
    isIP(hostname) === 0
      ? await lookup(hostname, { all: true, verbatim: true })
      : [{ address: hostname, family: isIP(hostname) }];
  if (resolvedAddresses.length === 0) {
    throw new Error(`web_fetch could not resolve ${hostname}`);
  }
  if (resolvedAddresses.some(result => isDisallowedIpAddress(result.address))) {
    throw new Error(`web_fetch blocked ${hostname} because it resolved to a local, private, or reserved address`);
  }

  const selected = resolvedAddresses[0]!;
  return {
    originalUrl: url,
    address: selected.address,
    family: selected.family,
    servername: isIP(hostname) === 0 ? hostname : undefined,
  };
}

async function requestDestination(destination: ValidatedDestination): Promise<TransportResponse> {
  const { originalUrl } = destination;
  const transport = originalUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = transport(
      {
        protocol: originalUrl.protocol,
        hostname: destination.address,
        family: destination.family,
        port: originalUrl.port || undefined,
        path: `${originalUrl.pathname}${originalUrl.search}`,
        method: 'GET',
        servername: destination.servername,
        headers: {
          accept: 'text/html, text/plain, application/json, application/*+json, application/xml;q=0.9, */*;q=0.1',
          'accept-encoding': 'identity',
          host: originalUrl.host,
          'user-agent': 'MastraCode/0.1 web_fetch',
        },
      },
      (response: IncomingMessage) => {
        resolve({
          statusCode: response.statusCode ?? 0,
          statusMessage: response.statusMessage ?? '',
          headers: response.headers,
          body: response,
          dispose: () => response.destroy(),
        });
      },
    );

    request.once('error', reject);
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`web_fetch timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    request.end();
  });
}

function readHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedContentType(contentType: string): boolean {
  if (!contentType) return true;
  const mediaType = contentType.split(';')[0]!.trim().toLowerCase();
  return (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType.endsWith('+json') ||
    mediaType === 'application/xml' ||
    mediaType.endsWith('+xml') ||
    mediaType === 'application/javascript'
  );
}

async function readResponseBody(response: TransportResponse): Promise<string> {
  const contentLength = Number(readHeader(response.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    response.dispose();
    throw new Error(`web_fetch response exceeds the ${MAX_RESPONSE_BYTES}-byte limit`);
  }

  const contentEncoding = readHeader(response.headers, 'content-encoding');
  if (contentEncoding && contentEncoding !== 'identity') {
    response.dispose();
    throw new Error(`web_fetch does not accept compressed responses (${contentEncoding})`);
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      response.dispose();
      throw new Error(`web_fetch response exceeds the ${MAX_RESPONSE_BYTES}-byte limit`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function fetchPublicUrl(rawUrl: string, dependencies: WebFetchDependencies = {}): Promise<string> {
  let nextUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const destination = await resolveValidatedDestination(nextUrl, dependencies.lookup);
    const response = await (dependencies.transport ?? requestDestination)(destination);
    const location = readHeader(response.headers, 'location');
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && location) {
      response.dispose();
      if (redirectCount === MAX_REDIRECTS) throw new Error(`web_fetch exceeded ${MAX_REDIRECTS} redirects`);
      nextUrl = new URL(location, destination.originalUrl).toString();
      continue;
    }

    const contentType = readHeader(response.headers, 'content-type') ?? '';
    if (!isSupportedContentType(contentType)) {
      response.dispose();
      throw new Error(`web_fetch cannot read content type ${contentType || 'unknown'}`);
    }

    const body = await readResponseBody(response);
    const content = truncateStringForTokenEstimate(body, MAX_WEB_FETCH_TOKENS);
    return [
      `URL: ${destination.originalUrl.toString()}`,
      `Status: ${response.statusCode} ${response.statusMessage}`.trimEnd(),
      `Content-Type: ${contentType || 'unknown'}`,
      '',
      content,
    ].join('\n');
  }

  throw new Error(`web_fetch exceeded ${MAX_REDIRECTS} redirects`);
}

export function createWebFetchTool() {
  return createTool({
    id: 'web-fetch',
    description:
      'Fetch a public HTTP(S) page or API directly. Use this for exact, current source content after web_search discovers a URL. Local, private, and reserved network destinations are blocked.',
    inputSchema: z.object({
      url: z.string().url().describe('The exact public HTTP(S) URL to retrieve'),
    }),
    execute: async ({ url }) => fetchPublicUrl(url),
  });
}

export const __testing = {
  fetchPublicUrl,
  isDisallowedIpAddress,
  resolveValidatedDestination,
};
