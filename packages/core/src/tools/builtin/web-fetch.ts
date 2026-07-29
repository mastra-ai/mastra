import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress, LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { z } from 'zod/v4';

import { createTool } from '../tool';

const MAX_CONTENT_LENGTH = 100_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

class WebFetchError extends Error {}

function parseHttpUrl(url: string): URL | undefined {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' ? parsedUrl : undefined;
  } catch {
    return undefined;
  }
}

function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost');
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  const [first = 0, second = 0] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && parts[2] === 0) ||
    (first === 192 && second === 0 && parts[2] === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function parseIpv4MappedGroups(address: string): number[] | undefined {
  const ipv4Start = address.lastIndexOf(':');
  const ipv4Address = address.slice(ipv4Start + 1);

  if (!ipv4Address.includes('.')) {
    return undefined;
  }

  const ipv4Parts = ipv4Address.split('.').map(Number);
  if (ipv4Parts.length !== 4 || ipv4Parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return undefined;
  }

  const [first, second, third, fourth] = ipv4Parts as [number, number, number, number];

  return [...expandIpv6(address.slice(0, ipv4Start), 6), (first << 8) + second, (third << 8) + fourth];
}

function expandIpv6(address: string, expectedGroups = 8): number[] {
  const [left = '', right = ''] = address.split('::');
  const leftGroups = left ? left.split(':') : [];
  const rightGroups = right ? right.split(':') : [];
  const missingGroups = expectedGroups - leftGroups.length - rightGroups.length;
  const groups = address.includes('::')
    ? [...leftGroups, ...Array(missingGroups).fill('0'), ...rightGroups]
    : leftGroups;

  return groups.map(group => Number.parseInt(group || '0', 16));
}

function isBlockedIpv6(address: string): boolean {
  const normalizedAddress = normalizeHostname(address).toLowerCase();
  const groups = normalizedAddress.includes('.')
    ? parseIpv4MappedGroups(normalizedAddress)
    : expandIpv6(normalizedAddress);

  if (!groups || groups.length !== 8 || groups.some(group => Number.isNaN(group))) {
    return false;
  }

  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const isIpv4Mapped = [first, second, third, fourth, fifth].every(group => group === 0) && sixth === 0xffff;

  return (
    groups.every(group => group === 0) ||
    (groups.slice(0, 7).every(group => group === 0) && eighth === 1) ||
    (isIpv4Mapped && isBlockedIpv4([seventh >> 8, seventh & 255, eighth >> 8, eighth & 255].join('.'))) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
  );
}

function isBlockedIp(address: string): boolean {
  const normalizedAddress = normalizeHostname(address);
  const ipVersion = net.isIP(normalizedAddress);
  return ipVersion === 4
    ? isBlockedIpv4(normalizedAddress)
    : ipVersion === 6
      ? isBlockedIpv6(normalizedAddress)
      : false;
}

function assertAllowedUrl(url: URL): void {
  const hostname = normalizeHostname(url.hostname);

  if (isBlockedHostname(hostname) || isBlockedIp(hostname)) {
    throw new WebFetchError('URL resolves to a private or reserved address.');
  }
}

function createLookup() {
  return (
    hostname: string,
    options: LookupOptions,
    callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    dnsLookup(hostname, options, (error, address, family) => {
      if (error) {
        callback(error, address, family);
        return;
      }

      const resolvedAddresses = Array.isArray(address) ? address.map(result => result.address) : [address];
      const blockedAddress = resolvedAddresses.find(isBlockedIp);

      if (blockedAddress) {
        callback(new WebFetchError('URL resolves to a private or reserved address.'), address, family);
        return;
      }

      callback(null, address, family);
    });
  };
}

async function readBody(response: http.IncomingMessage): Promise<{ content: string; truncated: boolean }> {
  const decoder = new TextDecoder();
  let content = '';
  let truncated = false;

  for await (const chunk of response) {
    content += typeof chunk === 'string' ? chunk : decoder.decode(chunk as Buffer, { stream: true });

    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH);
      truncated = true;
      response.destroy();
      break;
    }
  }

  if (!truncated) {
    content += decoder.decode();
  }

  return { content, truncated };
}

async function requestUrl(
  url: URL,
  redirectsRemaining = MAX_REDIRECTS,
): Promise<{
  content: string;
  truncated: boolean;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  url?: string;
  ok?: boolean;
}> {
  assertAllowedUrl(url);

  return new Promise((resolve, reject) => {
    const requestModule = url.protocol === 'https:' ? https : http;
    const request = requestModule.request(
      url,
      {
        headers: {
          'user-agent': 'Mastra Web Fetch Tool/1.0',
          accept: 'text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.8',
        },
        lookup: createLookup(),
        timeout: TIMEOUT_MS,
      },
      response => {
        void (async () => {
          const location = response.headers.location;

          if (location && response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
            response.resume();

            if (redirectsRemaining <= 0) {
              throw new WebFetchError(`Too many redirects. Maximum is ${MAX_REDIRECTS}.`);
            }

            const nextUrl = parseHttpUrl(new URL(location, url).toString());
            if (!nextUrl) {
              throw new WebFetchError('Redirect target must use HTTP or HTTPS.');
            }

            resolve(await requestUrl(nextUrl, redirectsRemaining - 1));
            return;
          }

          const { content, truncated } = await readBody(response);

          resolve({
            content,
            truncated,
            status: response.statusCode,
            statusText: response.statusMessage,
            contentType: Array.isArray(response.headers['content-type'])
              ? response.headers['content-type'][0]
              : (response.headers['content-type'] ?? null),
            url: url.toString(),
            ok: response.statusCode ? response.statusCode >= 200 && response.statusCode < 300 : false,
          });
        })().catch(reject);
      },
    );

    request.on('timeout', () => {
      request.destroy(new WebFetchError(`Request timed out after ${TIMEOUT_MS}ms.`));
    });
    request.on('error', reject);
    request.end();
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export const webFetchTool = createTool({
  id: 'web_fetch',
  description: 'Fetch a web page by URL and return text content with basic response metadata.',
  inputSchema: z.object({
    url: z.string().min(1).describe('The fully qualified HTTP or HTTPS URL to fetch.'),
  }),
  outputSchema: z.object({
    content: z.string(),
    truncated: z.boolean().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
    contentType: z.string().nullable().optional(),
    url: z.string().optional(),
    ok: z.boolean().optional(),
    isError: z.boolean().optional(),
  }),
  execute: async ({ url }: { url: string }) => {
    const parsedUrl = parseHttpUrl(url);

    if (!parsedUrl) {
      return {
        content: 'Failed to fetch URL: only HTTP and HTTPS URLs are supported.',
        isError: true,
      };
    }

    try {
      return await requestUrl(parsedUrl);
    } catch (error) {
      return {
        content: `Failed to fetch URL: ${getErrorMessage(error)}`,
        isError: true,
      };
    }
  },
});
