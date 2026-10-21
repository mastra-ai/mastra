/** Wire-stable `Error.name`: the server flattens errors to `{ name, message }`, so hosts match on this. */
export const PROVIDER_AUTH_REQUIRED_ERROR = 'ProviderAuthRequiredError';

/**
 * A provider credential is missing or no longer usable. The message states the
 * fact only — how the user re-authenticates is the host's call (`/login` in the
 * TUI, Settings → Models in the factory web UI), so no host advertises a
 * command another host doesn't have.
 */
export class ProviderAuthRequiredError extends Error {
  readonly name = PROVIDER_AUTH_REQUIRED_ERROR;
}

function providerErrorMessage(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const error = parsed.error;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if (typeof error === 'string') return error;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return body.trim() || undefined;
}

/**
 * A stored OAuth token the provider rejects (revoked, signed out elsewhere) is
 * the same user-facing state as a missing one, so a 401 becomes
 * `ProviderAuthRequiredError`. `status` and `requestUrl` stay on the error:
 * account rotation reads them to force a refresh and attribute the provider.
 */
export async function rejectUnauthorizedResponse(
  response: Response,
  { providerName, requestUrl }: { providerName: string; requestUrl: string },
): Promise<Response> {
  if (response.status !== 401) return response;
  const detail = providerErrorMessage(await response.text().catch(() => ''));
  const message = `${providerName} rejected the stored sign-in${detail ? `: ${detail}` : '.'}`;
  throw Object.assign(new ProviderAuthRequiredError(message), { status: 401, requestUrl });
}
