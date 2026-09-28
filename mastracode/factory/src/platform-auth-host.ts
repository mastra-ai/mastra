export const PLATFORM_AUTH_PROVIDER = 'mastra-studio';
export const CUSTOM_DOMAIN_UNSUPPORTED_ERROR = 'custom_domain_unsupported';

const PLATFORM_AUTH_DOMAINS = ['mastra.cloud', 'mastra.ai'] as const;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isPlatformAuthSupportedHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(normalizedHostname)) return true;
  return PLATFORM_AUTH_DOMAINS.some(
    domain => normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`),
  );
}
