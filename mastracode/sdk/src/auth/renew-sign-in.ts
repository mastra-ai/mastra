import { SignInRenewalFailedError } from './provider-auth-error.js';

/**
 * Call a provider's token-renewal endpoint and parse the new credentials.
 *
 * Only a 4xx other than 429 means the provider refused the stored sign-in; that
 * throws a plain error, which credential stores report as an expired sign-in.
 * Anything else (offline, timed out, 429/5xx, or a response that isn't the
 * token, such as a captive-portal page) leaves the sign-in valid and throws
 * `SignInRenewalFailedError`. `parse` throws when the body isn't the token.
 */
export async function renewSignIn<T>(
  providerName: string,
  request: () => Promise<Response>,
  parse: (body: unknown) => T,
): Promise<T> {
  const unreachable = (detail: string, cause?: unknown) =>
    new SignInRenewalFailedError(`Couldn't reach ${providerName} to renew the sign-in: ${detail}`, { cause });

  let response: Response;
  try {
    response = await request();
  } catch (error) {
    throw unreachable(error instanceof Error ? error.message : String(error), error);
  }

  if (response.status === 429 || response.status >= 500) {
    throw Object.assign(unreachable(`token server returned ${response.status}`), { status: response.status });
  }
  if (!response.ok) {
    throw new Error(`${providerName} token refresh failed: ${response.status}`);
  }

  try {
    return parse(await response.json());
  } catch (error) {
    throw unreachable('unreadable token response', error);
  }
}
