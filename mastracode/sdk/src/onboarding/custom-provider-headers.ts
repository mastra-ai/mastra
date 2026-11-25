/**
 * Rules for the extra headers a custom OpenAI-compatible provider sends.
 *
 * This module imports nothing at runtime, so settings parsing, the TUI and the
 * Factory routes can validate headers without loading the AI SDK.
 */
import type { CustomProviderAuthScheme } from './settings.js';

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
  'keep-alive',
  'upgrade',
  'expect',
  'te',
  'trailer',
  'proxy-connection',
];

/** The `token` grammar of RFC 9110, which every header name must match. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Characters outside tab, printable ASCII and printable Latin-1. The HTTP
 * client refuses ASCII control characters and anything above 0xFF at call
 * time, so such a value would fail every request instead of failing when it
 * is saved. The C1 controls (0x80 to 0x9F) are refused too: a plain value is
 * shown in lists, and U+009B starts an escape sequence on terminals that act
 * on 8-bit controls.
 */
const INVALID_HEADER_VALUE_CHARACTER = /[^\t\x20-\x7e\xa0-\xff]/;

/** The longest part of a refused header name repeated in the problem text. */
const MAX_QUOTED_NAME_LENGTH = 100;

/**
 * A C0 or C1 control character, including the ESC and CSI that start terminal
 * escape sequences. Text from an endpoint or a request body is printed in the
 * TUI, so every place that shows it uses this one definition. Not global, so
 * `test` keeps no state; derive a global copy for `replace`.
 */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point.
export const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * A refused header name made safe to show. The name may come from a request
 * body and end up in a terminal, so it is cut short and its control
 * characters become spaces.
 */
function quotableName(name: string): string {
  const shown = name.slice(0, MAX_QUOTED_NAME_LENGTH).replace(new RegExp(CONTROL_CHARACTER_PATTERN.source, 'g'), ' ');
  return name.length > MAX_QUOTED_NAME_LENGTH ? `${shown}...` : shown;
}

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
 * Entries are typed loosely because they often come straight from a request
 * body, where a name or value may not be a string.
 */
export function customProviderHeaderProblem(
  headers: ReadonlyArray<{ name: unknown; value?: unknown }>,
  authScheme: CustomProviderAuthScheme | undefined,
): string | undefined {
  if (!Array.isArray(headers)) return 'Custom headers must be a list.';
  if (headers.length > MAX_CUSTOM_PROVIDER_HEADERS) {
    return `A provider can send at most ${MAX_CUSTOM_PROVIDER_HEADERS} custom headers.`;
  }
  const authHeader = customProviderAuthHeaderName(authScheme).toLowerCase();
  const seen = new Set<string>();
  for (const header of headers as unknown[]) {
    if (typeof header !== 'object' || header === null) return 'Each custom header needs a name and a value.';
    const { name, value } = header as { name: unknown; value?: unknown };
    if (typeof name !== 'string') return 'Each custom header name must be text.';
    if (!HEADER_NAME_PATTERN.test(name)) {
      return `"${quotableName(name)}" is not a valid header name.`;
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
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      return `The ${name} header value must be text.`;
    }
    // Saving trims the value, so a value of only spaces would be saved empty and then dropped on reload.
    if (value.trim().length === 0) {
      return `The ${name} header has no value.`;
    }
    if (value.length > MAX_CUSTOM_PROVIDER_HEADER_VALUE_LENGTH) {
      return `The ${name} header value is longer than ${MAX_CUSTOM_PROVIDER_HEADER_VALUE_LENGTH} characters.`;
    }
    if (/[\r\n]/.test(value)) {
      return `The ${name} header value cannot contain a line break.`;
    }
    if (INVALID_HEADER_VALUE_CHARACTER.test(value)) {
      return `The ${name} header value can only hold printable characters up to U+00FF.`;
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
