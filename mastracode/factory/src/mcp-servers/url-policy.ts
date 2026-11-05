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
  ['64:ff9b:1::', 48], // local-use NAT64
  ['2001::', 32], // Teredo, which tunnels to an IPv4 address that cannot be checked
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

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(address: string): number[] {
  let text = address.toLowerCase();
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number) as [number, number, number, number];
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parse = (part: string | undefined) => (part ? part.split(':').map(group => parseInt(group, 16)) : []);
  if (!text.includes('::')) return parse(text);
  const [head, tail] = text.split('::');
  const before = parse(head);
  const after = parse(tail);
  return [...before, ...Array<number>(8 - before.length - after.length).fill(0), ...after];
}

/** The IPv4 address that NAT64 (`64:ff9b::/96`) or 6to4 (`2002::/16`) routes an IPv6 address to. */
function embeddedIPv4(address: string): string | null {
  const groups = ipv6Groups(address);
  const ipv4 = (high: number, low: number) => `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(group => group === 0)) {
    return ipv4(groups[6]!, groups[7]!);
  }
  if (groups[0] === 0x2002) return ipv4(groups[1]!, groups[2]!);
  return null;
}

/**
 * True for loopback, private, link-local, CGNAT, multicast, and reserved
 * addresses, including the IPv6 forms that reach one of those IPv4 addresses
 * (IPv4-mapped, NAT64, 6to4) and Teredo.
 */
export function isPrivateAddress(address: string): boolean {
  if (checkAddress(PRIVATE_ADDRESSES, address)) return true;
  const normalized = normalizeAddress(address);
  if (isIP(normalized) !== 6) return false;
  const embedded = embeddedIPv4(normalized);
  return embedded !== null && checkAddress(PRIVATE_ADDRESSES, embedded);
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
 * `fetch` that refuses non-https requests (plain http only for loopback when
 * private networks are allowed) and requests to private addresses unless they
 * are allowed. Redirects are never followed automatically, in either mode: a
 * caller that passes `redirect: 'manual'` gets the redirect back and re-enters
 * this guard for the next hop (the MCP SDK does this for every transport and
 * OAuth request, following only same-origin hops), and for any other caller a
 * redirect fails, so saved headers never reach a host nobody checked.
 */
export function createGuardedFetch({ allowPrivateNetwork }: McpServerNetworkOptions): GuardedFetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const plainHttpAllowed = allowPrivateNetwork && url.protocol === 'http:' && isLoopbackHost(hostnameOf(url));
    if (url.protocol !== 'https:' && !plainHttpAllowed) {
      throw new McpServerNetworkPolicyError(`Requests to "${url.host}" were blocked because they do not use https.`);
    }
    if (!allowPrivateNetwork) await assertPublicHost(url);
    const response = await fetch(input, { ...init, redirect: 'manual' });
    if (init?.redirect !== 'manual' && REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      throw new McpServerNetworkPolicyError(`"${url.host}" responded with a redirect, which is not followed.`);
    }
    return response;
  };
}
