/**
 * Where a provider hands out API keys, for surfaces that can show or open the
 * page directly. Absent providers have no known key page.
 */
const PROVIDER_KEY_URLS: Record<string, string> = {
  // Zen keys live on the OpenCode account, shared by both Zen providers.
  opencode: 'https://opencode.ai/auth',
  'opencode-go': 'https://opencode.ai/auth',
};

export function getProviderKeyUrl(providerId: string): string | undefined {
  return PROVIDER_KEY_URLS[providerId];
}
