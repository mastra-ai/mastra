/**
 * Rules for the extra headers a custom OpenAI-compatible provider sends.
 *
 * This module imports nothing at runtime, so settings parsing, the TUI and the
 * Factory routes can validate headers without loading the AI SDK.
 */
import type { CustomProviderAuthScheme, CustomProviderHeader } from './settings.js';

/** The most custom headers one provider may send. */
export const MAX_CUSTOM_PROVIDER_HEADERS = 20;

/** The longest custom header value accepted, in characters. */
export const MAX_CUSTOM_PROVIDER_HEADER_VALUE_LENGTH = 4096;

/**
 * Header names a custom header may never use, in lower case. The HTTP client
 * owns these, and a wrong value breaks or smuggles the request. The header the
 * auth scheme writes is refused as well, see {@link customProviderAuthHeaderName}.
 */
export const REFUSED_CUSTOM_PROVIDER_HEADER_NAMES: readonly string[] = [
  'host',
  'content-length',
  'content-type',
  'transfer-encoding',
  'connection',
];

/** The `token` grammar of RFC 9110, which every header name must match. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * The header the auth scheme writes the key into. A missing scheme means
 * `bearer`, which is how providers saved before schemes existed authenticate.
 */
export function customProviderAuthHeaderName(authScheme: CustomProviderAuthScheme | undefined): string {
  return authScheme === 'x-api-key' ? 'x-api-key' : 'Authorization';
}

/** Whether a value read from settings or a request body is a known auth scheme. */
export function isCustomProviderAuthScheme(value: unknown): value is CustomProviderAuthScheme {
  return value === 'bearer' || value === 'x-api-key';
}

/**
 * Why `headers` cannot be saved with `authScheme`, or undefined when they can.
 *
 * An entry without `value` is accepted, because an edit may keep a saved value
 * by naming the header only. The caller decides whether a value is required.
 */
export function customProviderHeaderProblem(
  headers: ReadonlyArray<Pick<CustomProviderHeader, 'name'> & { value?: string }>,
  authScheme: CustomProviderAuthScheme | undefined,
): string | undefined {
  if (headers.length > MAX_CUSTOM_PROVIDER_HEADERS) {
    return `A provider can send at most ${MAX_CUSTOM_PROVIDER_HEADERS} custom headers.`;
  }
  const authHeader = customProviderAuthHeaderName(authScheme).toLowerCase();
  const seen = new Set<string>();
  for (const header of headers) {
    const name = header.name;
    if (!HEADER_NAME_PATTERN.test(name)) {
      return `"${name}" is not a valid header name.`;
    }
    const lowerName = name.toLowerCase();
    if (REFUSED_CUSTOM_PROVIDER_HEADER_NAMES.includes(lowerName)) {
      return `The ${name} header is set by the HTTP client and cannot be sent as a custom header.`;
    }
    if (lowerName === authHeader) {
      return `The ${name} header carries the API key for this auth scheme and cannot be sent as a custom header.`;
    }
    if (seen.has(lowerName)) {
      return `The ${name} header is listed more than once.`;
    }
    seen.add(lowerName);
    if (header.value === undefined) continue;
    if (header.value.length === 0) {
      return `The ${name} header has no value.`;
    }
    if (/[\r\n]/.test(header.value)) {
      return `The ${name} header value cannot contain a line break.`;
    }
    if (header.value.length > MAX_CUSTOM_PROVIDER_HEADER_VALUE_LENGTH) {
      return `The ${name} header value is longer than ${MAX_CUSTOM_PROVIDER_HEADER_VALUE_LENGTH} characters.`;
    }
  }
  return undefined;
}

/**
 * Merge header maps in order. Names are compared ignoring case and a later
 * entry replaces an earlier one, keeping the later spelling. `fetch` would
 * otherwise join `X-Foo` and `x-foo` into one comma-separated value.
 */
export function mergeHeadersIgnoringCase(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> {
  const merged = new Map<string, [string, string]>();
  for (const source of sources) {
    if (!source) continue;
    for (const [name, value] of Object.entries(source)) {
      const key = name.toLowerCase();
      // Delete first so the replaced header moves to the position of the later entry.
      merged.delete(key);
      merged.set(key, [name, value]);
    }
  }
  return Object.fromEntries(merged.values());
}
