/**
 * SSRF policy for MCP Events webhook callback URLs (SEP-3415 "Webhook security").
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
import { promises as dns } from 'node:dns';
import { BlockList, isIP } from 'node:net';

/** @experimental SEP-3415 is a draft; this API may change. */
export type WebhookUrlFailure = 'invalid_url' | 'insecure_scheme' | 'disallowed_address' | 'dns_failure';

/**
 * Thrown when a callback URL fails the webhook URL policy.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class WebhookUrlError extends Error {
  readonly reason: WebhookUrlFailure;
  readonly url: string;

  constructor(reason: WebhookUrlFailure, url: string, message: string) {
    super(message);
    this.name = 'WebhookUrlError';
    this.reason = reason;
    this.url = url;
  }
}

/** @experimental SEP-3415 is a draft; this API may change. */
export type WebhookLookup = (hostname: string) => Promise<Array<{ address: string; family: 4 | 6 }>>;

/** @experimental SEP-3415 is a draft; this API may change. */
export interface WebhookUrlPolicyOptions {
  /** Skip address classification, allowing private and loopback targets (tests and private deployments). */
  allowPrivate?: boolean;
  /** Allow `http:` callback URLs. */
  allowInsecure?: boolean;
  /** Resolver used for hostnames. Defaults to `dns.promises.lookup` returning every address. */
  lookup?: WebhookLookup;
}

/** @experimental SEP-3415 is a draft; this API may change. */
export interface ResolvedWebhookUrl {
  url: URL;
  /** The validated IP that delivery must connect to, so a later DNS answer cannot rebind it. */
  address: string;
  family: 4 | 6;
}

// IANA IPv4 / IPv6 Special-Purpose Address Registries: ranges that are not globally routable.
const BLOCKED_IPV4: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const BLOCKED_IPV6: ReadonlyArray<[string, number]> = [
  // Unspecified, loopback and the deprecated IPv4-compatible block.
  ['::', 96],
  // IPv4-mapped: rejected outright rather than unwrapped.
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['3fff::', 20],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

const ipv4BlockList = new BlockList();
for (const [network, prefix] of BLOCKED_IPV4) {
  ipv4BlockList.addSubnet(network, prefix, 'ipv4');
}
const ipv6BlockList = new BlockList();
for (const [network, prefix] of BLOCKED_IPV6) {
  ipv6BlockList.addSubnet(network, prefix, 'ipv6');
}

/** Expand an IPv6 address (no zone, no brackets) into its eight 16-bit groups. */
function ipv6Groups(ip: string): number[] {
  // WHATWG URL serializes IPv6 in canonical hex form, converting any dotted IPv4 tail.
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const [head = '', tail] = canonical.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array<string>(8 - headGroups.length - tailGroups.length).fill('0');
  return [...headGroups, ...fill, ...tailGroups].map(group => parseInt(group, 16));
}

function groupsToIPv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isGlobalIPv4(ip: string): boolean {
  return !ipv4BlockList.check(ip, 'ipv4');
}

/**
 * True when a literal IP address is globally routable. Non-IP input, scoped (zone) addresses, and
 * NAT64 / 6to4 addresses that embed a non-global IPv4 address are all treated as not routable.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function isGloballyRoutableAddress(ip: string): boolean {
  const address = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  if (address.includes('%')) {
    return false;
  }
  const family = isIP(address);
  if (family === 4) {
    return isGlobalIPv4(address);
  }
  if (family !== 6) {
    return false;
  }
  if (ipv6BlockList.check(address, 'ipv6')) {
    return false;
  }
  const groups = ipv6Groups(address);
  // NAT64 well-known prefix 64:ff9b::/96 embeds the IPv4 address in the last 32 bits.
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(group => group === 0)) {
    return isGlobalIPv4(groupsToIPv4(groups[6]!, groups[7]!));
  }
  // 6to4 2002::/16 embeds the IPv4 address in bits 16-47.
  if (groups[0] === 0x2002) {
    return isGlobalIPv4(groupsToIPv4(groups[1]!, groups[2]!));
  }
  return true;
}

/** `URL.hostname` brackets IPv6 literals; strip them for classification and DNS. */
function bareHostname(url: URL): string {
  return url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
}

/**
 * Synchronously validate a callback URL: it must parse, use `https:` (unless `allowInsecure`), carry no
 * credentials, and, when its host is an IP literal, that IP must be globally routable (unless `allowPrivate`).
 * Hostnames are not resolved here; use {@link resolveAndValidate} before connecting.
 *
 * @throws {WebhookUrlError}
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function validateWebhookUrl(url: string, opts: WebhookUrlPolicyOptions = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebhookUrlError('invalid_url', url, 'Webhook URL is not a valid URL');
  }
  if (parsed.protocol === 'http:') {
    if (!opts.allowInsecure) {
      throw new WebhookUrlError('insecure_scheme', url, 'Webhook URL must use https');
    }
  } else if (parsed.protocol !== 'https:') {
    throw new WebhookUrlError('invalid_url', url, `Webhook URL scheme "${parsed.protocol}" is not supported`);
  }
  if (parsed.username || parsed.password) {
    throw new WebhookUrlError('invalid_url', url, 'Webhook URL must not contain credentials');
  }
  const host = bareHostname(parsed);
  if (!host) {
    throw new WebhookUrlError('invalid_url', url, 'Webhook URL has no host');
  }
  if (!opts.allowPrivate && isIP(host) !== 0 && !isGloballyRoutableAddress(host)) {
    throw new WebhookUrlError('disallowed_address', url, `Webhook URL host ${host} is not globally routable`);
  }
  return parsed;
}

const defaultLookup: WebhookLookup = async hostname => {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  return answers.map(({ address, family }) => ({ address, family: family === 6 ? 6 : 4 }));
};

/**
 * Validate a callback URL and resolve it to the IP that delivery must connect to. Every resolved address
 * must be globally routable (a mixed answer is a DNS-rebinding vector); the first is returned as the pinned
 * address. Delivery connects to that address and uses the URL hostname for TLS SNI and the Host header.
 *
 * @throws {WebhookUrlError}
 * @experimental SEP-3415 is a draft; this API may change.
 */
export async function resolveAndValidate(url: string, opts: WebhookUrlPolicyOptions = {}): Promise<ResolvedWebhookUrl> {
  const parsed = validateWebhookUrl(url, opts);
  const host = bareHostname(parsed);
  const literalFamily = isIP(host);
  if (literalFamily === 4 || literalFamily === 6) {
    return { url: parsed, address: host, family: literalFamily };
  }

  let answers: Awaited<ReturnType<WebhookLookup>>;
  try {
    answers = await (opts.lookup ?? defaultLookup)(host);
  } catch {
    throw new WebhookUrlError('dns_failure', url, `Webhook URL host ${host} could not be resolved`);
  }
  const [first] = answers;
  if (!first) {
    throw new WebhookUrlError('dns_failure', url, `Webhook URL host ${host} resolved to no addresses`);
  }
  if (!opts.allowPrivate) {
    const blocked = answers.find(answer => !isGloballyRoutableAddress(answer.address));
    if (blocked) {
      throw new WebhookUrlError(
        'disallowed_address',
        url,
        `Webhook URL host ${host} resolves to ${blocked.address}, which is not globally routable`,
      );
    }
  }
  return { url: parsed, address: first.address, family: first.family };
}
