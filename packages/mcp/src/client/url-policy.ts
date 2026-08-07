import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';

/**
 * Redirect status codes the manual redirect loop follows. Other 3xx statuses
 * (e.g. 304) are not redirects and are returned to the caller as-is.
 */
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/** Maximum number of redirect hops followed before failing. */
const MAX_REDIRECT_HOPS = 5;

function normalizeHost(host: string): string {
  return host.toLowerCase();
}

/**
 * Minimal structural view of a fetch response. Both the platform `Response`
 * and the eventsource package's `FetchLikeResponse` (used for a caller-supplied
 * `eventSourceInit.fetch`) satisfy it.
 */
type ResponseLike = { readonly url: string; readonly body?: unknown };

/** Best-effort release of a discarded response body so its socket is not left undrained. */
function cancelResponseBody(response: ResponseLike): void {
  const body = response.body as { cancel?: () => Promise<unknown> } | null | undefined;
  if (typeof body?.cancel !== 'function') {
    return;
  }
  try {
    void Promise.resolve(body.cancel()).catch(() => {});
  } catch {
    // some Response implementations throw synchronously on cancel
  }
}

function isHostAllowed(host: string, allowedHosts: readonly string[]): boolean {
  const normalized = normalizeHost(host);
  return allowedHosts.some(allowed => normalizeHost(allowed) === normalized);
}

/**
 * Marker phrase embedded in every policy error's message. The `eventsource`
 * package flattens errors thrown from the SSE stream's fetch into a plain
 * message string (its internal `flattenError`), and the SDK re-wraps that
 * string as `SseError` — the `MastraError` identity does not survive that
 * boundary, but the message text does. {@link isUrlPolicyError} falls back to
 * matching this marker.
 */
const URL_POLICY_ERROR_MARKER = 'allowedHosts policy';

/**
 * Build the policy-violation error. The message deliberately avoids every
 * substring matched by `isReconnectableMCPError` (see ./error-utils.ts) so a
 * policy violation is never treated as a transient transport failure and fed
 * into the reconnect machinery — a blocked host must not be retried.
 */
function hostNotAllowedError(host: string, allowedHosts: readonly string[], detail: string): MastraError {
  const allowedList =
    allowedHosts.length > 0 ? allowedHosts.map(h => `"${h}"`).join(', ') : '(empty list — all hosts are denied)';
  return new MastraError({
    id: 'MCP_CLIENT_HOST_NOT_ALLOWED',
    domain: ErrorDomain.MCP,
    category: ErrorCategory.USER,
    text: `Host "${host}" is blocked by the allowedHosts policy. Allowed hosts: ${allowedList}. ${detail}`,
    details: { host, allowedHosts: allowedHosts.join(',') },
  });
}

/**
 * Assert that the URL's host is in the allowlist.
 *
 * Matching is exact and case-insensitive against `URL.host` (hostname plus
 * port when the URL carries a non-default port — WHATWG URL elides default
 * ports, so `https://x.com:443` has host `x.com`). No wildcards. An empty
 * allowlist denies every host. The URL scheme is not checked.
 *
 * @returns the parsed URL, for callers that need it.
 * @throws {MastraError} `MCP_CLIENT_HOST_NOT_ALLOWED` when the host is not allowed.
 */
export function assertHostAllowed(
  url: string | URL,
  allowedHosts: readonly string[],
  detail = 'The request was not sent.',
): URL {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  if (!isHostAllowed(parsed.host, allowedHosts)) {
    throw hostNotAllowedError(parsed.host, allowedHosts, detail);
  }
  return parsed;
}

/**
 * Post-hoc validation for responses produced by a caller-supplied fetch.
 *
 * A custom fetch may auto-follow redirects, so the final URL can differ from
 * the (already validated) request URL. When `response.url` lands on a
 * disallowed host the response is discarded by throwing — the outbound hop
 * already happened, but the data never reaches the caller or the model.
 *
 * Limitation (fail-open by design): a hand-built or proxied `Response` with an
 * empty `response.url` skips this check, because custom fetch implementations
 * legitimately construct such responses.
 */
export function assertResponseHostAllowed<R extends ResponseLike>(response: R, allowedHosts: readonly string[]): R {
  if (!response.url) {
    return response;
  }
  const parsed = new URL(response.url);
  if (!isHostAllowed(parsed.host, allowedHosts)) {
    cancelResponseBody(response);
    throw hostNotAllowedError(
      parsed.host,
      allowedHosts,
      'A custom fetch implementation followed a redirect to this host; the response was discarded.',
    );
  }
  return response;
}

/**
 * True when the error is one of the allowedHosts policy errors. Policy
 * violations are final: they must never trigger the SSE fallback or the
 * reconnect machinery, because retrying a blocked host cannot succeed.
 *
 * Matches by `MastraError` id when the identity is intact, and by the
 * {@link URL_POLICY_ERROR_MARKER} message marker for errors that crossed the
 * eventsource boundary (which flattens thrown errors to message strings) or
 * were re-wrapped by another layer.
 */
const URL_POLICY_ERROR_IDS = new Set([
  'MCP_CLIENT_HOST_NOT_ALLOWED',
  'MCP_CLIENT_TOO_MANY_REDIRECTS',
  'MCP_CLIENT_REDIRECT_MISSING_LOCATION',
  'MCP_CLIENT_REDIRECT_BODY_NOT_REPLAYABLE',
]);

export function isUrlPolicyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error instanceof MastraError && URL_POLICY_ERROR_IDS.has(error.id)) {
    return true;
  }
  return error.message.includes(URL_POLICY_ERROR_MARKER);
}

/**
 * Wrap a caller-supplied fetch with the allowedHosts policy: the request URL is
 * validated before the wrapped fetch runs, and the response is validated
 * post-hoc via {@link assertResponseHostAllowed}.
 *
 * Variadic over the trailing arguments deliberately: the same wrapper serves
 * the 3-arg `MastraFetchLike` (url, init, requestContext) and the 2-arg
 * eventsource stream fetch (url, init).
 */
export function wrapFetchWithHostPolicy<Args extends [url: string | URL, ...rest: any[]], R extends ResponseLike>(
  fetchImpl: (...args: Args) => Promise<R>,
  allowedHosts: readonly string[],
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    assertHostAllowed(args[0], allowedHosts);
    const response = await fetchImpl(...args);
    return assertResponseHostAllowed(response, allowedHosts);
  };
}

/**
 * Fetch with manual redirect handling so every redirect hop is validated
 * against the allowlist BEFORE the hop request is sent. Platform fetch follows
 * redirects transparently, which would bypass a per-call host check.
 *
 * Semantics follow platform conventions:
 * - `Location` is resolved against the current hop's URL (relative Locations are legal).
 * - 303 switches the method to GET and drops the body; 301/302 on POST do the same.
 * - 307/308 preserve method and body; a non-replayable body (anything other
 *   than a string) throws rather than silently re-sending an empty body.
 * - 301/302 on non-POST methods preserve the method and body, matching
 *   platform behavior.
 * - The `Authorization` header is not carried across hops to a different
 *   origin (scheme, host, or port change), matching the WHATWG Fetch
 *   credential-stripping rule — same host over a downgraded scheme still
 *   drops the header.
 * - A redirect status with no `Location` header throws.
 * - More than {@link MAX_REDIRECT_HOPS} hops throws.
 */
export async function fetchFollowingAllowedRedirects(
  fetchImpl: (url: string | URL, init?: RequestInit) => Promise<Response>,
  url: string | URL,
  init: RequestInit | undefined,
  allowedHosts: readonly string[],
): Promise<Response> {
  let currentUrl = assertHostAllowed(url, allowedHosts);
  let method = init?.method ?? 'GET';
  let body = init?.body;
  const headers = new Headers(init?.headers);

  for (let redirectsFollowed = 0; ; redirectsFollowed++) {
    const response = await fetchImpl(currentUrl, { ...init, method, body, headers, redirect: 'manual' });
    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new MastraError({
        id: 'MCP_CLIENT_REDIRECT_MISSING_LOCATION',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.THIRD_PARTY,
        text: `Received a ${response.status} redirect with no Location header from "${currentUrl.host}" while following redirects under the allowedHosts policy.`,
      });
    }
    if (redirectsFollowed >= MAX_REDIRECT_HOPS) {
      throw new MastraError({
        id: 'MCP_CLIENT_TOO_MANY_REDIRECTS',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.THIRD_PARTY,
        // Interpolate only the host, not the full URL: a URL's path/query could
        // contain substrings (e.g. "sessionId") that isReconnectableMCPError
        // matches, which would misclassify this terminal failure as transient.
        text: `Exceeded the maximum of ${MAX_REDIRECT_HOPS} redirect hops while requesting host "${currentUrl.host}" under the allowedHosts policy.`,
      });
    }

    // Release the redirect response's body so its socket can be reused.
    cancelResponseBody(response);

    const nextUrl = new URL(location, currentUrl);
    assertHostAllowed(nextUrl, allowedHosts, `A redirect from "${currentUrl.host}" pointed at it; the hop was not followed.`);

    const methodUpper = method.toUpperCase();
    const dropsBody =
      response.status === 303 || ((response.status === 301 || response.status === 302) && methodUpper === 'POST');
    if (dropsBody) {
      method = 'GET';
      body = undefined;
      headers.delete('content-type');
      headers.delete('content-length');
    } else if (body != null && typeof body !== 'string') {
      // Any hop that preserves the body (307/308 always; 301/302 for non-POST
      // methods) would re-send an already consumed one-shot body, so guard on
      // "the body is preserved", not on specific status codes.
      throw new MastraError({
        id: 'MCP_CLIENT_REDIRECT_BODY_NOT_REPLAYABLE',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Cannot follow a ${response.status} redirect under the allowedHosts policy: the request body is not replayable (only string bodies can be re-sent).`,
      });
    }

    // WHATWG Fetch strips Authorization when the ORIGIN (scheme + host + port)
    // changes — host alone is not enough: a same-host https→http downgrade must
    // also drop the header or the bearer token is re-sent in cleartext.
    if (nextUrl.origin !== currentUrl.origin) {
      headers.delete('authorization');
    }

    currentUrl = nextUrl;
  }
}
