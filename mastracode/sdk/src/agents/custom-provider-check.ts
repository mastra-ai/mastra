/**
 * Requests to custom OpenAI-compatible endpoints: the headers they carry, the
 * chat model a session uses, and the checks that call an endpoint before or
 * after it is saved.
 *
 * `mastracode-gateway.ts` imports this module, so this module must never import
 * the gateway.
 */
import { STATUS_CODES } from 'node:http';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { APICallError, JSONParseError, RetryError, StreamProviderError, streamText, TypeValidationError } from 'ai';
import {
  CONTROL_CHARACTER_PATTERN,
  customProviderAuthHeaderName,
  mergeHeadersIgnoringCase,
} from '../onboarding/custom-provider-headers.js';
import type { CustomProviderAuthScheme, CustomProviderHeader } from '../onboarding/settings.js';

export { customProviderHeaderProblem } from '../onboarding/custom-provider-headers.js';

/** The language model `createCustomProviderChatModel` returns. */
export type CustomProviderChatModel = ReturnType<OpenAICompatibleProvider['chatModel']>;

/** Everything needed to call a custom endpoint, with saved secrets already resolved. */
export interface CustomProviderConnection {
  /**
   * Base URL, such as `https://host/v1`. Paths are appended to it as text, so
   * a query string or fragment (`https://host/v1/?api-version=1`) ends up in
   * the middle of every request path and is not supported.
   */
  url: string;
  apiKey?: string;
  authScheme?: CustomProviderAuthScheme;
  headers?: CustomProviderHeader[];
}

/**
 * `fetch` that refuses redirects. Servers call custom endpoints too, and a
 * redirect could aim that call at an address the saved URL never named.
 */
export const fetchWithoutRedirects: typeof fetch = (input, init) => fetch(input, { ...init, redirect: 'error' });

/**
 * The headers of a connection that is typed but may come straight from a
 * request body. Anything that is not a list of objects counts as no headers,
 * so a check returns a result instead of throwing on it.
 */
function headerList(connection: CustomProviderConnection): CustomProviderHeader[] {
  const headers: unknown = connection.headers;
  if (!Array.isArray(headers)) return [];
  return headers.filter((header): header is CustomProviderHeader => typeof header === 'object' && header !== null);
}

/** `value` when it is a string, for connection fields that may come from a request body. */
function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * The custom headers of a connection plus the header that carries its key.
 * The auth header comes last so that nothing can replace it.
 */
export function customProviderRequestHeaders(connection: CustomProviderConnection): Record<string, string> {
  const custom = Object.fromEntries(
    headerList(connection)
      .filter(header => typeof header.name === 'string' && typeof header.value === 'string')
      .map(header => [header.name, header.value]),
  );
  const apiKey = stringOrUndefined(connection.apiKey)?.trim();
  if (!apiKey) return mergeHeadersIgnoringCase(custom);
  const authValue = connection.authScheme === 'x-api-key' ? apiKey : `Bearer ${apiKey}`;
  return mergeHeadersIgnoringCase(custom, { [customProviderAuthHeaderName(connection.authScheme)]: authValue });
}

/**
 * The chat model a session uses for a custom endpoint. `requestHeaders` are
 * Mastra's own per-request headers (`x-thread-id`, `x-resource-id`). A custom
 * header may replace them, and nothing replaces the auth header.
 */
export function createCustomProviderChatModel(args: {
  providerId: string;
  connection: CustomProviderConnection;
  modelId: string;
  requestHeaders?: Record<string, string>;
}): CustomProviderChatModel {
  return buildChatModel(args, fetchWithoutRedirects);
}

/** {@link createCustomProviderChatModel} with the `fetch` to call through, so the model test can cap what it reads. */
function buildChatModel(
  args: Parameters<typeof createCustomProviderChatModel>[0],
  fetchImpl: typeof fetch,
): CustomProviderChatModel {
  // The key never goes in `apiKey`: the AI SDK writes that header first, where
  // a custom header of the same name would replace it.
  const provider = createOpenAICompatible({
    name: args.providerId,
    baseURL: args.connection.url,
    headers: mergeHeadersIgnoringCase(args.requestHeaders, customProviderRequestHeaders(args.connection)),
    fetch: fetchImpl,
  });
  return provider.chatModel(args.modelId);
}

/** Why a check failed, in terms a user can act on. */
export interface CustomProviderCheckFailure {
  kind: 'http' | 'network' | 'timeout' | 'redirect' | 'invalid_response';
  /** One line, for example "HTTP 403 Forbidden from https://host/v1/models". */
  message: string;
  status?: number;
  /** Upstream body excerpt as plain text, at most 1,000 characters. */
  detail?: string;
}

/** The outcome of {@link listCustomProviderModels}. */
export type CustomProviderModelsResult =
  | { ok: true; models: string[]; latencyMs: number }
  | { ok: false; failure: CustomProviderCheckFailure; latencyMs: number };

/** The outcome of {@link testCustomProviderModel}. */
export type CustomProviderModelTestResult =
  | { ok: true; reply: string; finishReason?: string; latencyMs: number }
  | { ok: false; failure: CustomProviderCheckFailure; latencyMs: number };

/** Options shared by both checks. */
export interface CustomProviderCheckOptions {
  /**
   * Deadline for the whole check: 10 s for the model list, 30 s for the test
   * message by default. A value that is not a positive finite number uses the
   * default, a fraction is rounded up to the next millisecond, and a value
   * above the platform timer maximum (2,147,483,647 ms) is capped at it, so a
   * check always has a deadline and never rejects on this option.
   */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Keep only the upstream error message or page title in `detail`, never raw body text. */
  summaryDetailOnly?: boolean;
}

const LIST_TIMEOUT_MS = 10_000;
/**
 * The most response bytes a check reads, for the model list and for the test
 * message alike. A real answer to either is far smaller, and the cap keeps an
 * endpoint from holding memory or the connection until the timeout.
 */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_DETAIL_LENGTH = 1000;
/** Shorter values match too much ordinary text to be worth redacting. */
const MIN_REDACTED_LENGTH = 4;
/** The cause message undici gives a fetch made with `redirect: 'error'` that met a redirect. */
const REDIRECT_CAUSE_MESSAGE = 'unexpected redirect';

/** The secret values a check sends, sorted by how they are kept out of failure text. */
interface SentSecrets {
  /** Replaced with `[redacted]`, longest first so a value that contains another is replaced whole. */
  redacted: string[];
  /** Too short to replace without mangling ordinary text. A detail that contains one is dropped instead. */
  tooShort: string[];
}

/**
 * The key and secret header values a check sends. A header without a
 * `secret` flag counts as secret. Each value is listed as sent and in the
 * form `oneLine` turns it into, so a value with a tab or a double space still
 * matches after the text was collapsed.
 */
function secretsSent(connection: CustomProviderConnection): SentSecrets {
  const values = [
    stringOrUndefined(connection.apiKey)?.trim(),
    ...headerList(connection)
      .filter(header => header.secret !== false)
      .map(header => header.value),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const forms = [...new Set(values.flatMap(value => [value, oneLine(value)]))].filter(Boolean);
  return {
    redacted: forms.filter(form => form.length >= MIN_REDACTED_LENGTH).sort((a, b) => b.length - a.length),
    tooShort: forms.filter(form => form.length < MIN_REDACTED_LENGTH),
  };
}

/** Replace every sent secret in `text`. Endpoints echo request headers in error pages often enough to matter. */
function redact(text: string, secrets: SentSecrets): string {
  return secrets.redacted.reduce((redacted, secret) => redacted.split(secret).join('[redacted]'), text);
}

/**
 * Redact the failure text and cut `detail` to its limit. Redaction runs first
 * so a cut never leaves part of a secret. The detail builders also redact the
 * upstream text before their own cuts and collapses. A detail that still
 * contains a secret too short to redact is dropped.
 */
function finishFailure(failure: CustomProviderCheckFailure, secrets: SentSecrets): CustomProviderCheckFailure {
  const { detail: rawDetail, ...rest } = failure;
  const redactedDetail = rawDetail === undefined ? '' : redact(rawDetail, secrets);
  // Checked before the cut, so a short secret split by it is caught too.
  const leaksShortSecret = secrets.tooShort.some(secret => redactedDetail.includes(secret));
  const detail = leaksShortSecret ? '' : redactedDetail.slice(0, MAX_DETAIL_LENGTH);
  return { ...rest, message: redact(failure.message, secrets), ...(detail ? { detail } : {}) };
}

/** Every control character, for `replace`. */
const CONTROL_CHARACTERS = new RegExp(CONTROL_CHARACTER_PATTERN.source, 'g');

/**
 * Collapse a text into one line. Control characters become spaces: the TUI
 * prints `detail`, and an endpoint must not be able to send escape sequences
 * to the user's terminal. Callers decode HTML entities first, so `&#27;` is
 * caught too.
 */
function oneLine(text: string): string {
  return text.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

/** Narrow an unknown JSON value to an object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The error message of a JSON error body, in the shapes OpenAI-compatible servers use. */
function jsonErrorMessage(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  if (isRecord(body.error) && typeof body.error.message === 'string') return body.error.message;
  if (typeof body.error === 'string') return body.error;
  if (typeof body.message === 'string') return body.message;
  return undefined;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * How much of an upstream body the detail is read from. Error pages put their
 * title and message near the top and the detail keeps 1,000 characters, so a
 * longer read adds nothing. The parsing is synchronous, which the timeout
 * cannot interrupt, so it must stay cheap on any body an endpoint sends.
 */
const DETAIL_SCAN_CHARS = 32 * 1024;

/** Elements whose content is not page text. */
const NON_TEXT_ELEMENTS = new Set(['head', 'script', 'style', 'title']);

/**
 * Decode the entities error pages commonly carry. Others, and numeric ones
 * outside Unicode, stay as written. The bounded lengths keep the scan linear.
 */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#[0-9]{1,8}|#x[0-9a-f]{1,8}|[a-z]{1,10});/gi, (entity, name: string) => {
    if (!name.startsWith('#')) return HTML_ENTITIES[name.toLowerCase()] ?? entity;
    const codePoint = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  });
}

/**
 * The `<title>` of an HTML page, then its text with tags removed. With
 * `summaryOnly`, the title alone.
 *
 * Every search is an `indexOf` that either moves the cursor past what it read
 * or ends the scan, so the work stays linear on tags that never close. An
 * unclosed comment, tag or non-text element ends the text there.
 */
function htmlDetail(html: string, summaryOnly: boolean, secrets: SentSecrets): string | undefined {
  // Entities can spell out a secret, so decoded text is redacted before `oneLine` changes its spacing.
  const readable = (text: string) => oneLine(redact(decodeHtmlEntities(text), secrets));
  // ASCII-only lower case keeps every index valid in `html`; `toLowerCase` can change the length.
  const lower = html.replace(/[A-Z]/g, letter => letter.toLowerCase());
  let title = '';
  const titleStart = lower.indexOf('<title');
  const titleOpenEnd = titleStart < 0 ? -1 : lower.indexOf('>', titleStart);
  const titleClose = titleOpenEnd < 0 ? -1 : lower.indexOf('</title', titleOpenEnd);
  if (titleClose >= 0) title = readable(html.slice(titleOpenEnd + 1, titleClose));
  if (summaryOnly) return title || undefined;

  const parts: string[] = [];
  const tagName = /[a-z][a-z0-9]*/y;
  let cursor = 0;
  while (cursor < html.length) {
    const open = lower.indexOf('<', cursor);
    if (open < 0) {
      parts.push(html.slice(cursor));
      break;
    }
    parts.push(html.slice(cursor, open), ' ');
    let resume = -1;
    if (lower.startsWith('<!--', open)) {
      const close = lower.indexOf('-->', open + 4);
      resume = close < 0 ? -1 : close + 3;
    } else {
      tagName.lastIndex = open + 1;
      const name = tagName.exec(lower)?.[0];
      const close = name && NON_TEXT_ELEMENTS.has(name) ? lower.indexOf(`</${name}`, open + 1) : open;
      const end = close < 0 ? -1 : lower.indexOf('>', close);
      resume = end < 0 ? -1 : end + 1;
    }
    if (resume < 0) break;
    cursor = resume;
  }
  const text = readable(parts.join(''));
  return [title, text].filter(Boolean).join(': ') || undefined;
}

/**
 * Plain text from an upstream body for {@link CustomProviderCheckFailure.detail}.
 * A body that cannot be read gives no detail, so a check still returns its failure.
 *
 * Secrets are redacted in the raw body, again in the decoded JSON message or
 * HTML text, both before any cut or whitespace collapse could split one or
 * change its spacing, and once more on the final text.
 */
function upstreamDetail(
  body: string,
  contentType: string | undefined,
  summaryOnly: boolean,
  secrets: SentSecrets,
): string | undefined {
  try {
    const trimmed = redact(body, secrets).trim();
    if (!trimmed) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = undefined;
    }
    const message = jsonErrorMessage(parsed);
    if (message !== undefined) {
      // JSON escapes can spell out a secret, so the parsed message is redacted again.
      const kept = oneLine(redact(message, secrets).slice(0, DETAIL_SCAN_CHARS));
      return dropCutSecretStart(kept, secrets, message.length > DETAIL_SCAN_CHARS) || undefined;
    }
    const head = trimmed.slice(0, DETAIL_SCAN_CHARS);
    const cut = trimmed.length > DETAIL_SCAN_CHARS;
    if (contentType?.toLowerCase().includes('text/html') || /^<(!doctype html|html)\b/i.test(head)) {
      // An encoded secret cut by the scan limit decodes to a piece that neither full form matches.
      const html = cut ? withoutTrailingPartialEntity(head) : head;
      return dropCutSecretStart(htmlDetail(html, summaryOnly, secrets) ?? '', secrets, cut) || undefined;
    }
    return summaryOnly ? undefined : dropCutSecretStart(oneLine(head), secrets, cut) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The failure for a response with an error status. Both checks map statuses
 * through this. The status text is the standard one for the code, never the
 * reason phrase the endpoint sent, so `message` carries no upstream text.
 */
function httpFailure(args: {
  status: number;
  url: string;
  body: string;
  contentType?: string;
  summaryOnly: boolean;
  secrets: SentSecrets;
}): CustomProviderCheckFailure {
  const statusText = STATUS_CODES[args.status] ?? '';
  return {
    kind: 'http',
    message: `HTTP ${args.status}${statusText ? ` ${statusText}` : ''} from ${args.url}`,
    status: args.status,
    detail: upstreamDetail(args.body, args.contentType, args.summaryOnly, args.secrets),
  };
}

/** Every message on an error's `cause` chain, outermost first. */
function causeMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = current.cause;
  }
  return messages;
}

/**
 * The failure for a request that got no response. `fetchWithoutRedirects`
 * refuses a redirect before any status is read, so a redirect is only
 * recognizable by its cause message.
 */
function connectionFailure(error: unknown, url: string, abort: AbortState): CustomProviderCheckFailure {
  if (abort.timedOut) {
    return { kind: 'timeout', message: `No answer from ${url} within ${abort.timeoutMs / 1000} s` };
  }
  if (abort.aborted) {
    return { kind: 'timeout', message: `The request to ${url} was cancelled` };
  }
  const messages = causeMessages(error);
  if (messages.includes(REDIRECT_CAUSE_MESSAGE)) {
    return { kind: 'redirect', message: `${url} answered with a redirect, and redirects are refused` };
  }
  const reason = messages.at(-1) ?? String(error);
  return { kind: 'network', message: `Could not reach ${url}: ${reason}` };
}

/** Read at most `maxBytes` of a body, so an endpoint cannot make a check buffer without limit. */
async function readCappedBody(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return { text: text + decoder.decode(), truncated: false };
    const room = maxBytes - received;
    if (value.byteLength > room) {
      text += decoder.decode(value.subarray(0, room));
      await reader.cancel();
      return { text, truncated: true };
    }
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * The longest model id kept. Real ids are well under this; a longer one is
 * noise or an attempt to flood the lists that show it.
 */
const MAX_MODEL_ID_LENGTH = 256;

/**
 * Whether an id from a model list may be shown and saved. Ids are dropped,
 * never cleaned, because a cleaned id is no longer the one the endpoint
 * expects. The TUI prints ids, so one with a control character could inject a
 * terminal escape sequence. An id that contains a secret the check sent is an
 * echo of the request and would hand that secret to whoever reads the list.
 */
function isUsableModelId(id: string, sentSecrets: string[]): boolean {
  if (!id || id.length > MAX_MODEL_ID_LENGTH) return false;
  if (CONTROL_CHARACTER_PATTERN.test(id)) return false;
  return !sentSecrets.some(secret => id.includes(secret));
}

/**
 * The model ids in a model list body, trimmed, deduplicated and sorted, or
 * undefined when the body is not a model list. Ids that fail
 * {@link isUsableModelId} are dropped, and a non-empty list that yields no id
 * is not a model list either.
 */
function modelIdsFromList(body: unknown, secrets: SentSecrets): string[] | undefined {
  // Only secrets long enough to redact are matched. A header such as `X-Ver: 1`
  // is secret by default, and a one to three character value inside an id
  // reveals nothing, while it would drop `gpt-4.1` and every id like it.
  const sent = secrets.redacted;
  let entries: unknown[];
  let nameIsId = false;
  if (Array.isArray(body)) entries = body;
  else if (isRecord(body) && Array.isArray(body.data)) entries = body.data;
  else if (isRecord(body) && Array.isArray(body.models)) {
    // Ollama-style lists name each model under `name`.
    entries = body.models;
    nameIsId = true;
  } else return undefined;

  const ids = new Set<string>();
  for (const entry of entries) {
    let id: unknown;
    if (typeof entry === 'string') id = Array.isArray(body) ? entry : undefined;
    else if (isRecord(entry)) id = typeof entry.id === 'string' ? entry.id : nameIsId ? entry.name : undefined;
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (isUsableModelId(trimmed, sent)) ids.add(trimmed);
  }
  // A list whose every id was dropped proves nothing about the endpoint, the same as a list without ids.
  if (entries.length > 0 && ids.size === 0) return undefined;
  return [...ids].sort();
}

/** Whether a check was stopped, and whether by its own timeout or by the caller. */
interface AbortState {
  timedOut: boolean;
  aborted: boolean;
  timeoutMs: number;
}

/** The largest delay Node timers accept. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * The timeout a check runs with. `AbortSignal.timeout` throws on a negative,
 * fractional or oversized value, and a check must return its failure, never
 * throw, so anything unusable falls back to the default.
 */
function checkTimeoutMs(requested: number | undefined, fallback: number): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested) || requested <= 0) return fallback;
  return Math.min(Math.ceil(requested), MAX_TIMEOUT_MS);
}

/**
 * A timeout signal joined with the caller's signal. `abortState` tells the
 * two apart after an abort. A caller signal that is not an `AbortSignal` is
 * ignored, because `AbortSignal.any` would throw on it.
 */
function checkSignal(timeoutMs: number, callerSignal: AbortSignal | undefined) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal instanceof AbortSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
  return {
    signal,
    abortState: (): AbortState => ({ timedOut: timeout.aborted, aborted: signal.aborted, timeoutMs }),
  };
}

/**
 * Call `GET {url}/models` and return the model ids the endpoint lists, or why
 * it could not. A failure is returned, never thrown.
 */
export async function listCustomProviderModels(
  connection: CustomProviderConnection,
  options: CustomProviderCheckOptions = {},
): Promise<CustomProviderModelsResult> {
  const started = performance.now();
  const latencyMs = () => Math.round(performance.now() - started);
  const secrets = secretsSent(connection);
  const summaryOnly = options.summaryDetailOnly ?? false;
  const timeoutMs = checkTimeoutMs(options.timeoutMs, LIST_TIMEOUT_MS);
  const url = `${(stringOrUndefined(connection.url) ?? '').trim().replace(/\/+$/, '')}/models`;
  const fail = (failure: CustomProviderCheckFailure): CustomProviderModelsResult => ({
    ok: false,
    failure: finishFailure(failure, secrets),
    latencyMs: latencyMs(),
  });

  const { signal, abortState } = checkSignal(timeoutMs, options.signal);
  let response: Response;
  let body: { text: string; truncated: boolean };
  try {
    response = await fetchWithoutRedirects(url, {
      method: 'GET',
      headers: mergeHeadersIgnoringCase({ Accept: 'application/json' }, customProviderRequestHeaders(connection)),
      signal,
    });
  } catch (error) {
    return fail(connectionFailure(error, url, abortState()));
  }
  const contentType = response.headers.get('content-type') ?? undefined;
  try {
    body = await readCappedBody(response, MAX_RESPONSE_BYTES);
  } catch (error) {
    // The status already says what went wrong, so an error body that breaks off only costs the detail.
    if (!response.ok) return fail(httpFailure({ status: response.status, url, body: '', summaryOnly, secrets }));
    return fail(connectionFailure(error, url, abortState()));
  }

  if (!response.ok) {
    return fail(
      httpFailure({
        status: response.status,
        url,
        body: body.text,
        contentType,
        summaryOnly,
        secrets,
      }),
    );
  }

  if (body.truncated) {
    return fail({
      kind: 'invalid_response',
      message: `The model list from ${url} is larger than ${MAX_RESPONSE_BYTES / 1024 / 1024} MB`,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    parsed = undefined;
  }
  const models = modelIdsFromList(parsed, secrets);
  if (!models) {
    return fail({
      kind: 'invalid_response',
      message: `The response from ${url} is not a model list`,
      status: response.status,
      detail: upstreamDetail(body.text, contentType, summaryOnly, secrets),
    });
  }
  return { ok: true, models, latencyMs: latencyMs() };
}

const MODEL_TEST_TIMEOUT_MS = 30_000;
const MODEL_TEST_PROMPT = 'Reply with the single word "yes".';
/**
 * The longest reply the model test keeps. The prompt asks for one word, so a
 * few thousand characters already prove the model answers, and a model that
 * keeps going would otherwise hold the check and its memory until the timeout.
 * A reply cut here is still a working model.
 */
const MAX_REPLY_CHARS = 4000;

/**
 * `fetchWithoutRedirects` that counts the bytes of each response body and
 * calls `onCap` once the count passes `maxBytes`. The body then ends with an
 * error, and `onCap` aborts the request so the connection closes.
 */
function byteCappedFetch(maxBytes: number, onCap: () => void): typeof fetch {
  return async (input, init) => {
    const response = await fetchWithoutRedirects(input, init);
    if (!response.body) return response;
    let received = 0;
    const counted = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received <= maxBytes) {
            controller.enqueue(chunk);
            return;
          }
          onCap();
          controller.error(new Error(`response passed ${maxBytes} bytes`));
        },
      }),
    );
    return new Response(counted, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/** A response header by name, ignoring case, from the plain object the AI SDK keeps on its errors. */
function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

/**
 * The failure for an error from the test message. With `maxRetries: 0` the
 * AI SDK should not wrap it in a `RetryError`, but the last attempt is read
 * if one gets through.
 */
function modelTestFailure(args: {
  error: unknown;
  chatUrl: string;
  abort: AbortState;
  summaryOnly: boolean;
  secrets: SentSecrets;
}): CustomProviderCheckFailure {
  const error = RetryError.isInstance(args.error) ? args.error.lastError : args.error;
  if (APICallError.isInstance(error)) {
    // Some AI SDK versions wrap a stream that breaks after a 200 in an error that keeps the 200.
    // The endpoint did not refuse the call, so that is a transport failure, not "HTTP 200 OK".
    const refused = error.statusCode !== undefined && (error.statusCode < 200 || error.statusCode >= 300);
    if (refused && error.statusCode !== undefined) {
      return httpFailure({
        status: error.statusCode,
        url: error.url,
        body: error.responseBody ?? '',
        contentType: headerValue(error.responseHeaders, 'content-type'),
        summaryOnly: args.summaryOnly,
        secrets: args.secrets,
      });
    }
    if (error.statusCode !== undefined && !args.abort.aborted) {
      const reason = causeMessages(error).at(-1) ?? 'the connection closed';
      return { kind: 'network', message: `The answer from ${error.url} broke off: ${reason}` };
    }
    return connectionFailure(error, error.url, args.abort);
  }
  if (args.abort.aborted) {
    return connectionFailure(error, args.chatUrl, args.abort);
  }
  return {
    kind: 'invalid_response',
    message: `The answer from ${args.chatUrl} is not an OpenAI-compatible stream`,
    detail: streamErrorDetail(error, args.summaryOnly, args.secrets),
  };
}

/**
 * The detail for a stream that failed after a 200. The AI SDK puts raw
 * upstream text in the messages of its parse errors, so that text only goes
 * in `detail`, and only without `summaryOnly`. An error chunk is the
 * endpoint's own error report, so its message is kept like a JSON error body.
 *
 * The AI SDK turns an error chunk with an `error.message` into a
 * `StreamProviderError`. A chunk whose `error` is a plain string fails the
 * chunk schema and arrives as a `TypeValidationError` holding the parsed
 * chunk in `value`, which is read the same way an HTTP error body is.
 * Secrets are redacted before the text is cut or collapsed.
 */
function streamErrorDetail(error: unknown, summaryOnly: boolean, secrets: SentSecrets): string | undefined {
  const clean = (text: string) => oneLine(redact(text, secrets).slice(0, DETAIL_SCAN_CHARS)) || undefined;
  let reported: string | undefined;
  if (StreamProviderError.isInstance(error)) reported = error.message;
  else if (TypeValidationError.isInstance(error)) reported = jsonErrorMessage(error.value);
  else if (!(error instanceof Error)) reported = jsonErrorMessage({ error });
  if (reported !== undefined) return clean(reported);
  if (summaryOnly) return undefined;
  let raw: string;
  try {
    if (JSONParseError.isInstance(error)) raw = error.text;
    else if (TypeValidationError.isInstance(error)) raw = JSON.stringify(error.value) ?? '';
    else if (error instanceof Error) raw = error.message;
    else raw = typeof error === 'string' ? error : (JSON.stringify(error) ?? '');
  } catch {
    return undefined;
  }
  return clean(raw);
}

/**
 * Send one short message to a model on a custom endpoint and return its reply,
 * or why it failed. A failure is returned, never thrown, and the request is
 * made once: a check that retries hides the error the user needs to see.
 */
export async function testCustomProviderModel(
  args: { providerId: string; connection: CustomProviderConnection; modelId: string },
  options: CustomProviderCheckOptions = {},
): Promise<CustomProviderModelTestResult> {
  const started = performance.now();
  const latencyMs = () => Math.round(performance.now() - started);
  const secrets = secretsSent(args.connection);
  const timeoutMs = checkTimeoutMs(options.timeoutMs, MODEL_TEST_TIMEOUT_MS);
  const chatUrl = `${(stringOrUndefined(args.connection.url) ?? '').trim().replace(/\/+$/, '')}/chat/completions`;
  const { signal, abortState } = checkSignal(timeoutMs, options.signal);

  let reply = '';
  let finishReason: string | undefined;
  let streamError: unknown;
  let stopped = false;
  let replyCut = false;
  let bytesCapped = false;
  const stopReading = new AbortController();
  // Reasoning or empty deltas never reach the reply budget, so the bytes read are capped as well.
  const cappedFetch = byteCappedFetch(MAX_RESPONSE_BYTES, () => {
    bytesCapped = true;
    stopReading.abort();
  });
  try {
    const result = streamText({
      model: buildChatModel(args, cappedFetch),
      prompt: MODEL_TEST_PROMPT,
      maxRetries: 0,
      abortSignal: AbortSignal.any([signal, stopReading.signal]),
      // In `ai` 7 a provider error arrives as an `error` part on `fullStream`.
      // The default handler would also print it to the console.
      onError: () => {},
    });
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        reply += part.text;
        if (reply.length >= MAX_REPLY_CHARS) {
          replyCut = true;
          // Leaving the loop alone does not close the request, so the stream is aborted too.
          stopReading.abort();
          break;
        }
      } else if (part.type === 'finish') finishReason = part.finishReason;
      else if (part.type === 'error') {
        streamError = part.error;
        stopped = true;
        break;
      } else if (part.type === 'abort') {
        // The timeout or the caller's signal fired: `streamText` ends with this part instead of an `error` part.
        stopped = true;
        break;
      }
    }
  } catch (error) {
    streamError = error;
    stopped = true;
  }

  // A model that produced text before the byte cap answered; one that produced none did not.
  if (bytesCapped && !replyCut && !reply) {
    const failure: CustomProviderCheckFailure = {
      kind: 'invalid_response',
      message: `The answer from ${chatUrl} passed ${MAX_RESPONSE_BYTES / 1024 / 1024} MB without any text`,
    };
    return { ok: false, failure: finishFailure(failure, secrets), latencyMs: latencyMs() };
  }
  const cut = replyCut || bytesCapped;
  // A signal that fires between parts can end the stream with neither `abort` nor `finish`.
  // A stream that reached `finish` keeps its result even if the signal fires afterwards.
  if (!cut && (stopped || (signal.aborted && finishReason === undefined))) {
    const failure = modelTestFailure({
      error: streamError,
      chatUrl,
      abort: abortState(),
      summaryOnly: options.summaryDetailOnly ?? false,
      secrets,
    });
    return { ok: false, failure: finishFailure(failure, secrets), latencyMs: latencyMs() };
  }
  return {
    ok: true,
    reply: safeReply(reply, secrets, cut),
    ...(finishReason ? { finishReason } : {}),
    latencyMs: latencyMs(),
  };
}

/** Control characters except tab and newline, which a multi-line reply may keep. */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point.
const REPLY_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/**
 * The reply as it may be returned. An endpoint that echoes request headers
 * into its completion would hand a saved secret to someone allowed to run the
 * check but not to read the secret, so the reply is redacted like failure
 * text. Redaction runs before the cut to the reply budget so the cut cannot
 * split a secret.
 *
 * Unlike `detail`, a reply is not emptied for a secret too short to redact:
 * a one to three character value inside a one-word reply reveals nothing,
 * while an error excerpt can repeat it next to its header name.
 *
 * When the reply was cut, by the reply budget or the byte cap, a trailing
 * part that begins a secret is dropped, since the rest of that secret never
 * arrived to be matched. Control characters become spaces because the TUI
 * prints the reply.
 */
function safeReply(reply: string, secrets: SentSecrets, cut: boolean): string {
  const kept = dropCutSecretStart(redact(reply, secrets).slice(0, MAX_REPLY_CHARS), secrets, cut);
  return kept.replace(REPLY_CONTROL_CHARACTERS, ' ').trim();
}

/**
 * `html` without an entity that the scan limit cut before its `;`, such as
 * `tenant&#`. Left in place it is never decoded, so the decoded text would
 * end in a piece of an encoded secret that no secret form begins with.
 * Removing it lets {@link dropCutSecretStart} see the decoded start that
 * remains. Only the last `&` is examined, so the work stays constant.
 */
function withoutTrailingPartialEntity(html: string): string {
  const ampersand = html.lastIndexOf('&');
  if (ampersand < 0 || html.length - ampersand > 12) return html;
  return /^&(#x?[0-9a-f]*|[a-z]*)$/i.test(html.slice(ampersand)) ? html.slice(0, ampersand) : html;
}

/**
 * `text` without a trailing piece that begins a sent secret, when the text was
 * cut. Only the start of such a secret arrived, so no redaction could match it.
 * Both the sent and the collapsed form of each secret are checked.
 */
function dropCutSecretStart(text: string, secrets: SentSecrets, cut: boolean): string {
  if (!cut) return text;
  return text.slice(0, text.length - trailingSecretPrefixLength(text, secrets)).trim();
}

/**
 * The length of the longest end of `text` that is the start of a sent secret.
 * Candidate starts are scanned from the longest down, and each comparison
 * stops at the first differing character, so ordinary text costs little.
 */
function trailingSecretPrefixLength(text: string, secrets: SentSecrets): number {
  let longest = 0;
  for (const secret of secrets.redacted) {
    for (let start = Math.max(0, text.length - secret.length + 1); start < text.length - longest; start++) {
      let matched = 0;
      while (start + matched < text.length && text.charCodeAt(start + matched) === secret.charCodeAt(matched)) {
        matched++;
      }
      if (start + matched === text.length) {
        longest = matched;
        break;
      }
    }
  }
  return longest;
}
