import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Outbound network policy for organization MCP servers. Server URLs are
 * checked when they are saved ({@link parseMcpServerUrl}) and every request is
 * checked again when it is sent ({@link createGuardedFetch}), because a public
 * hostname can resolve to a private address.
 *
 * Residual risk: the guard resolves the hostname before the request, and the
 * socket resolves it again when it connects, so DNS rebinding between the two
 * lookups is not prevented.
 */
export interface McpServerNetworkOptions {
  /** Allow loopback, private, and link-local addresses (and plain http on loopback). */
  allowPrivateNetwork: boolean;
}

/** A server URL that cannot be saved. The message is safe to show to users. */
export class McpServerUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpServerUrlError';
  }
}

/** A request the network policy refused to send. Retrying cannot succeed. */
export class McpServerNetworkPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpServerNetworkPolicyError';
  }
}

const PRIVATE_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this network", including the unspecified address
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, including cloud metadata endpoints
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3], // multicast and reserved
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 96], // unspecified, loopback, and IPv4-compatible addresses
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv6');
}

const LOOPBACK_ADDRESSES = new BlockList();
LOOPBACK_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4');
LOOPBACK_ADDRESSES.addAddress('::1', 'ipv6');

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function normalizeAddress(address: string): string {
  // Zone ids (`fe80::1%eth0`) are not part of the address.
  return stripBrackets(address).split('%')[0]!;
}

function checkAddress(list: BlockList, address: string): boolean {
  const normalized = normalizeAddress(address);
  const family = isIP(normalized);
  if (family === 0) return false;
  // BlockList matches IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) against IPv4 rules.
  return list.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved, and IPv4-mapped forms of those. */
export function isPrivateAddress(address: string): boolean {
  return checkAddress(PRIVATE_ADDRESSES, address);
}

function hostnameOf(url: URL): string {
  return stripBrackets(url.hostname.toLowerCase()).replace(/\.$/, '');
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost') || checkAddress(LOOPBACK_ADDRESSES, hostname);
}

/**
 * Validate a server URL before it is stored. Requires https (plain http only
 * for loopback hosts when private networks are allowed), rejects credentials
 * and fragments in the URL, and rejects private IP literals and `localhost`
 * unless private networks are allowed. Hostnames are resolved at request time.
 */
export function parseMcpServerUrl(raw: string, { allowPrivateNetwork }: McpServerNetworkOptions): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new McpServerUrlError('Enter a valid MCP server URL, for example https://mcp.example.com/mcp.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new McpServerUrlError('MCP server URLs must use https.');
  }
  if (url.username || url.password) {
    throw new McpServerUrlError(
      'Remove the username and password from the URL and add them as authentication instead.',
    );
  }
  if (url.hash) {
    throw new McpServerUrlError('MCP server URLs cannot contain a fragment (#).');
  }
  const hostname = hostnameOf(url);
  const loopback = isLoopbackHost(hostname);
  if ((loopback || isPrivateAddress(hostname)) && !allowPrivateNetwork) {
    throw new McpServerUrlError('MCP servers on local or private network addresses are not allowed.');
  }
  // A loopback host got here only because private networks are allowed.
  if (url.protocol === 'http:' && !loopback) {
    throw new McpServerUrlError(
      'MCP server URLs must use https. Plain http is only allowed for local development servers.',
    );
  }
  return url;
}

/** Reject hosts that are, or resolve to, a private address. */
async function assertPublicHost(url: URL): Promise<void> {
  const hostname = hostnameOf(url);
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true, verbatim: true })).map(entry => entry.address);
  if (addresses.some(address => isPrivateAddress(address))) {
    throw new McpServerNetworkPolicyError(
      `Requests to "${url.host}" were blocked because it resolves to a local or private network address.`,
    );
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type GuardedFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * `fetch` that refuses non-https requests and requests to private addresses
 * unless private networks are allowed. Redirects are never followed
 * automatically: callers that pass `redirect: 'manual'` (the `@mastra/mcp`
 * transport under `allowedHosts`) re-enter this guard for every hop, and any
 * other redirect fails instead of reaching an unchecked host.
 */
export function createGuardedFetch({ allowPrivateNetwork }: McpServerNetworkOptions): GuardedFetch {
  if (allowPrivateNetwork) return (input, init) => fetch(input, init);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.protocol !== 'https:') {
      throw new McpServerNetworkPolicyError(`Requests to "${url.host}" were blocked because they do not use https.`);
    }
    await assertPublicHost(url);
    const response = await fetch(input, { ...init, redirect: 'manual' });
    if (init?.redirect !== 'manual' && REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      throw new McpServerNetworkPolicyError(`"${url.host}" responded with a redirect, which is not followed.`);
    }
    return response;
  };
}
