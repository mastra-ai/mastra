import { BlockList, isIP } from 'node:net';

const LOCAL_ADDRESSES = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  LOCAL_ADDRESSES.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  LOCAL_ADDRESSES.addSubnet(address, prefix, 'ipv6');
}

const LOCAL_HOSTNAME = /(^|\.)(localhost|local|internal)$/;

/**
 * Whether this Factory runs on the Mastra platform. The platform stamps every
 * deploy with its id, and a Factory run anywhere else has none.
 */
export function hostedOnPlatform(): boolean {
  return Boolean(process.env.MASTRA_DEPLOYMENT_ID?.trim());
}

/**
 * Why a hosted Factory refuses to call `url`, or `undefined` when it may.
 * The server makes these calls, so a hosted one must not be pointed at its own
 * network or the cloud metadata service. Local and self-hosted Factories keep
 * reaching endpoints on their machine or network (Ollama, vLLM).
 */
export function customEndpointUrlProblem(url: string): string | undefined {
  if (!hostedOnPlatform()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Enter a valid URL.';
  }
  if (parsed.protocol !== 'https:')
    return 'Use an HTTPS address: a hosted Factory only calls custom endpoints over HTTPS.';
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const family = isIP(host);
  const local = family
    ? LOCAL_ADDRESSES.check(host, family === 6 ? 'ipv6' : 'ipv4')
    : LOCAL_HOSTNAME.test(host.replace(/\.$/, ''));
  if (local) return 'Use an address reachable over the internet, not a local or private network one.';
  return undefined;
}
