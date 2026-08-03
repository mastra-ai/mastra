/**
 * Forgiving parser for user-pasted OAuth authorization input.
 *
 * Accepts, in order of preference:
 *   - a full redirect URL (`https://.../callback?code=...&state=...`)
 *   - the `code#state` form shown on Anthropic's hosted callback page
 *   - a raw query string (`code=...&state=...`)
 *   - a bare authorization code
 *
 * Ported from pi-mono's `parseAuthorizationInput`.
 */
export function parseAuthorizationInput(input: string): {
  code?: string;
  state?: string;
} {
  const value = input.trim();
  if (!value) return {};

  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
    };
  } catch {
    // not a URL
  }

  if (value.includes('#')) {
    const [code, state] = value.split('#', 2);
    return { code, state };
  }

  if (value.includes('code=')) {
    const params = new URLSearchParams(value);
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
    };
  }

  return { code: value };
}
