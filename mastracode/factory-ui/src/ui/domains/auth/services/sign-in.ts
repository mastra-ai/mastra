import { CUSTOM_DOMAIN_UNSUPPORTED_ERROR, isPlatformAuthSupportedHost } from '@mastra/factory/platform-auth-host';
import type { FactoryAuthState } from './auth';

// Browsers can normalize backslashes into cross-origin redirects.
export function safeReturnTo(raw?: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}

export function isCustomDomainSignInBlocked(auth: FactoryAuthState, hostname: string, authError?: string): boolean {
  if (auth.provider !== 'mastra-studio') return false;
  if (auth.customDomainUnsupported) return true;
  if (authError === CUSTOM_DOMAIN_UNSUPPORTED_ERROR) return true;
  return !isPlatformAuthSupportedHost(hostname);
}
