/**
 * Shared options for MrScraper tools.
 *
 * Mirrors credentials used by the [MrScraper MCP](https://github.com/mrscraper/mrscraper-mcp) default surface:
 * app token (`x-api-token` / query) and a separate sync bearer for Google SERP.
 */
export interface MrScraperClientOptions {
  /**
   * MrScraper app API token (`x-api-token` header for app APIs, query `token` for fetch HTML).
   * Defaults to `MRSCRAPER_API_TOKEN` then `MRSCRAPER_TOKEN` env vars.
   */
  token?: string;
  /**
   * Bearer token for the Google SERP sync API (`atk_...`).
   * Defaults to `MRSCRAPER_SYNC_ACCESS_TOKEN` env var.
   */
  syncAccessToken?: string;
}

export function resolveAppToken(options?: MrScraperClientOptions): string {
  const token = options?.token ?? process.env.MRSCRAPER_API_TOKEN ?? process.env.MRSCRAPER_TOKEN;
  if (!token?.trim()) {
    throw new Error(
      'MrScraper app token is required. Pass { token } to the factory or set MRSCRAPER_API_TOKEN (or MRSCRAPER_TOKEN).',
    );
  }
  return token.trim();
}

export function normalizeBearerToken(accessToken: string): string {
  const t = accessToken.trim();
  if (t.toLowerCase().startsWith('bearer ')) {
    return t.slice(7).trim();
  }
  return t;
}

export function resolveSyncAccessToken(options?: MrScraperClientOptions): string {
  const token =
    options?.syncAccessToken?.trim() ??
    process.env.MRSCRAPER_SYNC_ACCESS_TOKEN?.trim() ??
    process.env.MRSCRAPER_SERP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'MrScraper sync access token is required for Google SERP. Pass { syncAccessToken } or set MRSCRAPER_SYNC_ACCESS_TOKEN.',
    );
  }
  return normalizeBearerToken(token);
}
