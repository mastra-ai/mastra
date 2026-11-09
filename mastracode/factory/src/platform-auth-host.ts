export const PLATFORM_AUTH_PROVIDER = 'mastra-studio';
export const CUSTOM_DOMAIN_UNSUPPORTED_ERROR = 'custom_domain_unsupported';

const PLATFORM_AUTH_DOMAINS = ['mastra.cloud', 'mastra.ai'] as const;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isPlatformAuthSupportedHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  // `*.localhost` is loopback too (RFC 6761), e.g. a dev proxy's per-worktree names.
  if (LOOPBACK_HOSTS.has(normalizedHostname) || normalizedHostname.endsWith('.localhost')) return true;
  return PLATFORM_AUTH_DOMAINS.some(
    domain => normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`),
  );
}
