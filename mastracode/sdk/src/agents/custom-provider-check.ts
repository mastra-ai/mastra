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
import { APICallError, RetryError, streamText } from 'ai';
import { customProviderAuthHeaderName, mergeHeadersIgnoringCase } from '../onboarding/custom-provider-headers.js';
import type { CustomProviderAuthScheme, CustomProviderHeader } from '../onboarding/settings.js';

export { customProviderHeaderProblem } from '../onboarding/custom-provider-headers.js';

/** The language model `createCustomProviderChatModel` returns. */
export type CustomProviderChatModel = ReturnType<OpenAICompatibleProvider['chatModel']>;

/** Everything needed to call a custom endpoint, with saved secrets already resolved. */
export interface CustomProviderConnection {
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
 * The custom headers of a connection plus the header that carries its key.
 * The auth header comes last so that nothing can replace it.
 */
export function customProviderRequestHeaders(connection: CustomProviderConnection): Record<string, string> {
  const custom = Object.fromEntries((connection.headers ?? []).map(header => [header.name, header.value]));
  const apiKey = connection.apiKey?.trim();
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
  // The key never goes in `apiKey`: the AI SDK writes that header first, where
  // a custom header of the same name would replace it.
  const provider = createOpenAICompatible({
    name: args.providerId,
    baseURL: args.connection.url,
    headers: mergeHeadersIgnoringCase(args.requestHeaders, customProviderRequestHeaders(args.connection)),
    fetch: fetchWithoutRedirects,
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
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Keep only the upstream error message or page title in `detail`, never raw body text. */
  summaryDetailOnly?: boolean;
}

const LIST_TIMEOUT_MS = 10_000;
const MAX_LIST_BODY_BYTES = 2 * 1024 * 1024;
const MAX_DETAIL_LENGTH = 1000;
/** Shorter values match too much ordinary text to be worth redacting. */
const MIN_REDACTED_LENGTH = 4;
/** The cause message undici gives a fetch made with `redirect: 'error'` that met a redirect. */
const REDIRECT_CAUSE_MESSAGE = 'unexpected redirect';

/**
 * The key and secret header values a check sends, longest first so a value
 * that contains another is replaced whole. A header without a `secret` flag
 * counts as secret.
 */
function secretsSent(connection: CustomProviderConnection): string[] {
  const values = [
    connection.apiKey?.trim(),
    ...(connection.headers ?? []).filter(header => header.secret !== false).map(header => header.value),
  ];
  return values
    .filter((value): value is string => typeof value === 'string' && value.length >= MIN_REDACTED_LENGTH)
    .sort((a, b) => b.length - a.length);
}

/** Replace every sent secret in `text`. Endpoints echo request headers in error pages often enough to matter. */
function redact(text: string, secrets: string[]): string {
  return secrets.reduce((redacted, secret) => redacted.split(secret).join('[redacted]'), text);
}

/** Redact the failure text and cut `detail` to its limit. Redaction runs first so a cut never leaves part of a secret. */
function finishFailure(failure: CustomProviderCheckFailure, secrets: string[]): CustomProviderCheckFailure {
  const { detail: rawDetail, ...rest } = failure;
  const detail = rawDetail === undefined ? undefined : redact(rawDetail, secrets).slice(0, MAX_DETAIL_LENGTH);
  return { ...rest, message: redact(failure.message, secrets), ...(detail ? { detail } : {}) };
}

/** Collapse runs of whitespace, so a multi-line body reads as one paragraph. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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

/** Decode the entities error pages commonly carry. Others stay as written. */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return HTML_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/** The `<title>` of an HTML page, then its text with tags removed. With `summaryOnly`, the title alone. */
function htmlDetail(html: string, summaryOnly: boolean): string | undefined {
  const title = oneLine(decodeHtmlEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''));
  if (summaryOnly) return title || undefined;
  const text = oneLine(
    decodeHtmlEntities(
      html
        .replace(/<(head|script|style|title)\b[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, ' '),
    ),
  );
  return [title, text].filter(Boolean).join(': ') || undefined;
}

/** Plain text from an upstream body for {@link CustomProviderCheckFailure.detail}, before redaction. */
function upstreamDetail(body: string, contentType: string | undefined, summaryOnly: boolean): string | undefined {
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = undefined;
  }
  const message = jsonErrorMessage(parsed);
  if (message !== undefined) return oneLine(message) || undefined;
  if (contentType?.toLowerCase().includes('text/html') || /^<(!doctype html|html)\b/i.test(trimmed)) {
    return htmlDetail(trimmed, summaryOnly);
  }
  return summaryOnly ? undefined : oneLine(trimmed);
}

/** The failure for a response with an error status. Both checks map statuses through this. */
function httpFailure(args: {
  status: number;
  statusText?: string;
  url: string;
  body: string;
  contentType?: string;
  summaryOnly: boolean;
}): CustomProviderCheckFailure {
  const statusText = args.statusText || STATUS_CODES[args.status] || '';
  return {
    kind: 'http',
    message: `HTTP ${args.status}${statusText ? ` ${statusText}` : ''} from ${args.url}`,
    status: args.status,
    detail: upstreamDetail(args.body, args.contentType, args.summaryOnly),
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
 * recognisable by its cause message.
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
 * The model ids in a model list body, trimmed, deduplicated and sorted, or
 * undefined when the body is not a model list. A non-empty list that yields no
 * id is not a model list either.
 */
function modelIdsFromList(body: unknown): string[] | undefined {
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
    if (typeof id === 'string' && id.trim()) ids.add(id.trim());
  }
  if (entries.length > 0 && ids.size === 0) return undefined;
  return [...ids].sort();
}

/** Whether a check was stopped, and whether by its own timeout or by the caller. */
interface AbortState {
  timedOut: boolean;
  aborted: boolean;
  timeoutMs: number;
}

/** A timeout signal joined with the caller's signal. `abortState` tells the two apart after an abort. */
function checkSignal(timeoutMs: number, callerSignal: AbortSignal | undefined) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
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
  const timeoutMs = options.timeoutMs ?? LIST_TIMEOUT_MS;
  const url = `${connection.url.trim().replace(/\/+$/, '')}/models`;
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
    body = await readCappedBody(response, MAX_LIST_BODY_BYTES);
  } catch (error) {
    return fail(connectionFailure(error, url, abortState()));
  }

  const contentType = response.headers.get('content-type') ?? undefined;
  if (!response.ok) {
    return fail(
      httpFailure({
        status: response.status,
        statusText: response.statusText,
        url,
        body: body.text,
        contentType,
        summaryOnly,
      }),
    );
  }

  if (body.truncated) {
    return fail({
      kind: 'invalid_response',
      message: `The model list from ${url} is larger than ${MAX_LIST_BODY_BYTES / 1024 / 1024} MB`,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    parsed = undefined;
  }
  const models = modelIdsFromList(parsed);
  if (!models) {
    return fail({
      kind: 'invalid_response',
      message: `The response from ${url} is not a model list`,
      status: response.status,
      detail: upstreamDetail(body.text, contentType, summaryOnly),
    });
  }
  return { ok: true, models, latencyMs: latencyMs() };
}

const MODEL_TEST_TIMEOUT_MS = 30_000;
const MODEL_TEST_PROMPT = 'Reply with the single word "yes".';

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
}): CustomProviderCheckFailure {
  const error = RetryError.isInstance(args.error) ? args.error.lastError : args.error;
  if (APICallError.isInstance(error)) {
    if (error.statusCode !== undefined) {
      return httpFailure({
        status: error.statusCode,
        url: error.url,
        body: error.responseBody ?? '',
        contentType: headerValue(error.responseHeaders, 'content-type'),
        summaryOnly: args.summaryOnly,
      });
    }
    return connectionFailure(error, error.url, args.abort);
  }
  if (args.abort.aborted) {
    return connectionFailure(error, args.chatUrl, args.abort);
  }
  const reason = error instanceof Error ? error.message : String(error);
  return { kind: 'invalid_response', message: `The answer from ${args.chatUrl} could not be read: ${reason}` };
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
  const timeoutMs = options.timeoutMs ?? MODEL_TEST_TIMEOUT_MS;
  const chatUrl = `${args.connection.url.trim().replace(/\/+$/, '')}/chat/completions`;
  const { signal, abortState } = checkSignal(timeoutMs, options.signal);

  let reply = '';
  let finishReason: string | undefined;
  let streamError: unknown;
  let stopped = false;
  try {
    const result = streamText({
      model: createCustomProviderChatModel(args),
      prompt: MODEL_TEST_PROMPT,
      maxRetries: 0,
      abortSignal: signal,
      // In `ai` 7 a provider error arrives as an `error` part on `fullStream`.
      // The default handler would also print it to the console.
      onError: () => {},
    });
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') reply += part.text;
      else if (part.type === 'finish') finishReason = part.finishReason;
      else if (part.type === 'error') {
        streamError = part.error;
        stopped = true;
        break;
      } else if (part.type === 'abort') {
        stopped = true;
        break;
      }
    }
  } catch (error) {
    streamError = error;
    stopped = true;
  }

  if (stopped || signal.aborted) {
    const failure = modelTestFailure({
      error: streamError,
      chatUrl,
      abort: abortState(),
      summaryOnly: options.summaryDetailOnly ?? false,
    });
    return { ok: false, failure: finishFailure(failure, secrets), latencyMs: latencyMs() };
  }
  return { ok: true, reply: reply.trim(), ...(finishReason ? { finishReason } : {}), latencyMs: latencyMs() };
}
