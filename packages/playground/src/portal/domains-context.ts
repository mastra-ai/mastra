import { createContext, useContext } from 'react';

/**
 * When rendered inside a Platform portal, the shell provides the Platform-
 * chosen enabled-domain map. When rendered as the standalone Studio SPA the
 * context is empty — consumers should treat "no keys" as "portal not active,
 * don't filter anything".
 */
export const EnabledDomainsContext = createContext<Record<string, boolean>>({});

export function useEnabledDomains(): Record<string, boolean> {
  return useContext(EnabledDomainsContext);
}

/**
 * Map from nav item `url` (as declared in `lib/nav/nav-items.tsx`) to the
 * Platform-level domain id it belongs to. Any URL not in this map is treated
 * as "no domain" and hidden in portal mode by default.
 *
 * Adding a new nav item to Studio should not silently appear in a Platform
 * host — Platform must explicitly opt in via `ENABLED_STUDIO_DOMAINS`.
 */
const NAV_URL_TO_DOMAIN: Record<string, string> = {
  '/agents': 'agents',
  '/prompts': 'agents',
  '/workflows': 'workflows',
  '/scorers': 'scorers',
  '/datasets': 'scorers',
  '/experiments': 'scorers',
  '/evaluation': 'scorers',
  '/traces': 'traces',
  '/metrics': 'traces',
  '/logs': 'traces',
  '/intelligence': 'traces',
};

/**
 * Returns true when the item should be shown given the Platform allowlist.
 * When `enabledDomains` has no keys (standalone Studio), always true — this
 * function is a no-op outside portal mode.
 */
export function isNavItemEnabled(url: string, enabledDomains: Record<string, boolean>): boolean {
  if (Object.keys(enabledDomains).length === 0) return true;
  const domain = NAV_URL_TO_DOMAIN[url];
  if (!domain) return false;
  return enabledDomains[domain] === true;
}
