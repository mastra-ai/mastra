// Reads an APICallError, a raw stream error frame, a cause chain or the persisted
// `{ name, message, statusCode?, code? }` identity. Status and codes decide first;
// context overflow and billing exhaustion have no code on any provider, so their wording lives here, once.
export type ProviderFailureKind =
  | 'auth'
  | 'quota'
  | 'rate_limited'
  | 'context_overflow'
  | 'model_rejected'
  | 'tool_history_rejected'
  | 'timeout'
  | 'unavailable'
  | 'invalid_request'
  | 'unknown';

export interface ProviderErrorFacts {
  statusCode?: number;
  code?: string;
}

const MAX_OBJECT_DEPTH = 4;
const ENVELOPE_TYPES = new Set(['error', 'response.failed']);

const QUOTA_EXHAUSTED =
  /usage (?:limit|cap)|insufficient[_ ]quota|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|insufficient (?:balance|credits?)|credits? exhausted|credit balance|weekly limit|monthly limit|payment required/i;
const ACCESS_DENIED =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|unauthorized|authentication|forbidden|permission[_ ]?(?:denied|error)|access[_ ]?denied/i;
const CONTEXT_OVERFLOW = [
  /context[_ ]length[_ ]exceeded/i,
  /maximum context length/i,
  /maximum prompt length/i,
  /prompt is too long/i,
  /input is too long/i,
  /exceed\w*\b[^.]{0,40}\bcontext (?:window|length|limit|size)/i,
  /input token count[^.]{0,40}exceeds the maximum/i,
  /reduce the length of the (?:messages|prompt|input)/i,
];
const MODEL_REJECTED =
  /model_not_found|model not found|no[_ ]?such[_ ]?model|not_found_error|invalid[_ ]model|unsupported[_ ]parameter|unsupported[_ ]value/i;
const TOOL_HISTORY_REJECTED =
  /no tool output found for (?:function|tool) call|tool_call_ids.*(?:response|respond)|tool_use.*tool_result/i;
const INVALID_REQUEST_CODE = /invalid_request_error/i;
const TIMED_OUT = /timed ?out|timeout|deadline exceeded/i;
const RATE_LIMITED = /rate[_ ]limit|too many requests|resource_exhausted|throttl/i;
const UNAVAILABLE =
  /internal server error|server_error|internal_error|service[_ ]?unavailable|temporarily[_ ]?unavailable|bad gateway|overloaded/i;
// What an HTTP client reports when the body said nothing; not a reason a person can act on.
const HTTP_REASON_PHRASE = /^(?:bad request|not found|unprocessable entity|payment required)\.?$/i;

interface CollectedFacts {
  statusCode?: number;
  codes: string[];
  texts: string[];
  seen: WeakSet<object>;
}

function readField(record: object, key: string): unknown {
  try {
    return (record as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function collect(value: unknown, facts: CollectedFacts, depth: number): void {
  if (depth > MAX_OBJECT_DEPTH || value === null || value === undefined) return;
  if (typeof value === 'string') {
    facts.texts.push(value);
    collect(parseJsonObject(value), facts, depth);
    return;
  }
  if (typeof value !== 'object' || facts.seen.has(value)) return;
  facts.seen.add(value);

  const status = readField(value, 'statusCode') ?? readField(value, 'status');
  if (typeof status === 'number' && facts.statusCode === undefined) facts.statusCode = status;
  // Google puts the HTTP status in `error.code` and a symbolic status in `error.status`.
  if (typeof status === 'string' && status.trim()) facts.codes.push(status);
  const code = readField(value, 'code');
  if (typeof code === 'number' && facts.statusCode === undefined && code >= 400 && code < 600) facts.statusCode = code;
  for (const candidate of [code, readField(value, 'type')]) {
    if (typeof candidate === 'string' && candidate.trim() && !ENVELOPE_TYPES.has(candidate))
      facts.codes.push(candidate);
  }
  const name = readField(value, 'name');
  if (typeof name === 'string') facts.texts.push(name);
  for (const key of ['message', 'responseBody']) collect(readField(value, key), facts, depth);
  for (const key of ['error', 'data', 'response', 'cause']) collect(readField(value, key), facts, depth + 1);
}

function collectFacts(error: unknown): CollectedFacts {
  const facts: CollectedFacts = { codes: [], texts: [], seen: new WeakSet() };
  collect(error, facts, 0);
  return facts;
}

export function classifyProviderError(error: unknown): ProviderFailureKind {
  const facts = collectFacts(error);
  const status = facts.statusCode;
  const evidence = [...facts.codes, ...facts.texts].join('\n');
  if (status === 401 || status === 403) return 'auth';
  if (status === 402 || QUOTA_EXHAUSTED.test(evidence)) return 'quota';
  // Token-per-minute limits are 429s whose message asks to shorten the request; waiting is the fix.
  if (status === 429) return 'rate_limited';
  if (ACCESS_DENIED.test(evidence)) return 'auth';
  if (CONTEXT_OVERFLOW.some(pattern => pattern.test(evidence))) return 'context_overflow';
  if (MODEL_REJECTED.test(evidence)) return 'model_rejected';
  if (TOOL_HISTORY_REJECTED.test(evidence)) return 'tool_history_rejected';
  // A request the provider named invalid is final, whatever its wording mentions.
  if (INVALID_REQUEST_CODE.test(evidence)) return 'invalid_request';
  if (status === 408 || status === 504 || TIMED_OUT.test(evidence)) return 'timeout';
  if (RATE_LIMITED.test(evidence)) return 'rate_limited';
  if ((status !== undefined && status >= 500) || UNAVAILABLE.test(evidence)) return 'unavailable';
  if (status === 400 || status === 404 || status === 422) return 'invalid_request';
  if (facts.texts.some(text => HTTP_REASON_PHRASE.test(text.trim()))) return 'invalid_request';
  return 'unknown';
}

/** The JSON-safe facts worth persisting next to a failure's name and message. */
export function providerErrorFacts(error: unknown): ProviderErrorFacts {
  const facts = collectFacts(error);
  const result: ProviderErrorFacts = {};
  if (facts.statusCode !== undefined) result.statusCode = facts.statusCode;
  if (facts.codes[0]) result.code = facts.codes[0];
  return result;
}

/** The innermost sentence a provider wrote for a person, unwrapped from envelopes and stringified layers. */
export function providerErrorReason(error: unknown): string | undefined {
  return innermostReason(error, 0);
}

function innermostReason(error: unknown, depth: number): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || error === null || error === undefined) return undefined;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    const parsed = parseJsonObject(trimmed);
    if (parsed !== undefined) return innermostReason(parsed, depth) ?? trimmed;
    return !trimmed || HTTP_REASON_PHRASE.test(trimmed) ? undefined : trimmed;
  }
  if (typeof error !== 'object') return undefined;
  for (const key of ['error', 'response', 'data']) {
    const reason = innermostReason(readField(error, key), depth + 1);
    if (reason) return reason;
  }
  const body = readField(error, 'responseBody');
  const bodyReason = typeof body === 'string' ? innermostReason(parseJsonObject(body), depth + 1) : undefined;
  if (bodyReason) return bodyReason;
  const message = readField(error, 'message');
  return typeof message === 'string' ? innermostReason(message, depth) : undefined;
}
