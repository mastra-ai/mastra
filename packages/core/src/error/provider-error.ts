import { capPersistedText } from '../loop/shared/provider-error-details';

// Reads an APICallError, a raw stream error frame, a cause chain or the persisted
// `{ name, message, statusCode?, code? }` identity. The status and symbolic codes are the provider's
// verdict; wording only narrows an invalid request, or speaks when the provider named nothing.
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
  codes?: string[];
  /** The innermost sentence behind HTTP phrases, envelopes, stringified layers and a wrapped provider response, when it differs from the message. */
  reason?: string;
}

const MAX_OBJECT_DEPTH = 4;
const ENVELOPE_TYPES = new Set(['error', 'response.failed']);
const SYMBOLIC_STATUS = /^[A-Z][A-Z0-9_]+$/;

const BILLING_EXHAUSTED =
  /insufficient[_ ]quota|insufficient (?:balance|credits?)|credits? exhausted|credit balance|payment required/i;
const USAGE_CAPPED =
  /usage (?:limit|cap)|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|weekly limit|monthly limit/i;
// A cap that refills within the hour is a rate limit, whatever the provider calls it.
const RENEWS_WITHIN_THE_HOUR = /per[_ -]?(?:second|minute|hour|min|sec)\b|\b[rt]pm\b/i;
const ACCESS_DENIED_WORDING =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|authentication[_ ]error|permission_?(?:denied|error)|access[_ ]?denied/i;
// Bare "unauthorized" or "forbidden" in free text can come from any service a run touches, not only the model provider.
const ACCESS_DENIED_CODE = new RegExp(`${ACCESS_DENIED_WORDING.source}|unauthorized|authentication|forbidden`, 'i');
const CONTEXT_OVERFLOW = [
  /context[_ ]length[_ ]exceeded/i,
  /maximum context length/i,
  /maximum prompt length/i,
  /prompt is too long/i,
  /input is too long/i,
  /exceed(?:s|ed|ing)?\b[^.]{0,40}\bcontext (?:window|length|limit|size)/i,
  /input token count[^.]{0,40}exceeds the maximum/i,
  /reduce the length of the (?:messages|prompt|input)/i,
];
const MODEL_REJECTED =
  /model_not_found|model not found|no[_ ]?such[_ ]?model|not_found_error|invalid[_ ]model|unsupported[_ ]model|\bmodel\b[^.]{0,40}\bis not supported\b|unsupported[_ ]parameter|unsupported[_ ]value/i;
const TOOL_HISTORY_REJECTED =
  /no tool output found for (?:function|tool) call|tool_call_ids[^.]{0,40}(?:response|respond)|tool_use[^.]{0,40}tool_result/i;
const INVALID_REQUEST_CODE = /invalid_request_error|invalid_prompt/i;
// The envelope type every OpenAI and Anthropic 400 carries; a code beside it is the provider naming the rejection.
const INVALID_REQUEST_ENVELOPE = /^invalid_request_error$/i;
const TIMED_OUT = /timed ?out|timeout|deadline[_ ]exceeded/i;
const RATE_LIMITED = /rate[_ ]limit|too many requests|resource_exhausted|throttl/i;
const UNAVAILABLE =
  /internal server error|server_error|internal_error|service[_ ]?unavailable|temporarily[_ ]?unavailable|bad gateway|overloaded/i;
// What an HTTP client reports when the body said nothing; not a reason a person can act on.
const HTTP_REASON_PHRASE =
  /^(?:bad request|unauthorized|payment required|forbidden|not found|method not allowed|not acceptable|proxy authentication required|request timeout|conflict|gone|length required|precondition failed|(?:payload|content|request entity) too large|(?:request-)?uri too long|unsupported media type|(?:requested )?range not satisfiable|expectation failed|i'm a teapot|misdirected request|unprocessable (?:entity|content)|locked|failed dependency|too early|upgrade required|precondition required|too many requests|request header fields too large|unavailable for legal reasons|internal server error|not implemented|bad gateway|service unavailable|gateway timeout|http version not supported|variant also negotiates|insufficient storage|loop detected|not extended|network authentication required)\.?$/i;

// A provider call saved before its status was kept says only the HTTP phrase; elsewhere a bare phrase names nobody.
const PROVIDER_CALL_ERROR_NAME = /^(?:AI_)?APICallError$/;
const ACCESS_DENIED_PHRASE = /^(?:unauthorized|forbidden)\.?$/i;

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

  const statusCode = readField(value, 'statusCode');
  if (typeof statusCode === 'number' && Number.isInteger(statusCode)) facts.statusCode ??= statusCode;
  // Providers report `statusCode`, or Google's numeric `error.code`; a numeric `status` is GitHub's, a fetch response's or a storage client's.
  const code = readField(value, 'code');
  if (typeof code === 'number' && Number.isInteger(code) && code >= 400 && code < 600) facts.statusCode ??= code;
  // Google's symbolic `error.status` names the failure; a lifecycle `status: 'failed'` names nothing.
  const status = readField(value, 'status');
  if (typeof status === 'string' && SYMBOLIC_STATUS.test(status.trim())) facts.codes.push(status.trim());
  const saved = readField(value, 'codes');
  const savedCodes = Array.isArray(saved) ? saved : [];
  for (const candidate of [code, readField(value, 'type'), ...savedCodes]) {
    if (typeof candidate === 'string' && candidate.trim() && !ENVELOPE_TYPES.has(candidate))
      facts.codes.push(candidate);
  }
  const name = readField(value, 'name');
  if (typeof name === 'string') facts.texts.push(name);
  for (const key of ['message', 'reason', 'detail', 'responseBody']) collect(readField(value, key), facts, depth);
  for (const key of ['error', 'data', 'response', 'cause']) collect(readField(value, key), facts, depth + 1);
}

function collectFacts(error: unknown): CollectedFacts {
  const facts: CollectedFacts = { codes: [], texts: [], seen: new WeakSet() };
  collect(error, facts, 0);
  return facts;
}

export function classifyProviderError(error: unknown): ProviderFailureKind {
  const facts = collectFacts(error);
  const evidence = [...facts.codes, ...facts.texts].join('\n');
  const verdict = providerVerdict(facts.statusCode, facts.codes.join('\n'), evidence);
  if (verdict === 'invalid_request') return narrowInvalidRequest(evidence, facts.statusCode, facts.codes);
  if (verdict) return verdict;
  return (
    usageKind(evidence) ??
    terminalKindFromWording(evidence) ??
    transientKindFromWording(evidence) ??
    providerCallPhraseKind(error, facts.texts) ??
    'unknown'
  );
}

function providerCallPhraseKind(error: unknown, texts: string[]): ProviderFailureKind | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const name = readField(error, 'name');
  if (typeof name !== 'string' || !PROVIDER_CALL_ERROR_NAME.test(name)) return undefined;
  const message = readField(error, 'message');
  if (typeof message === 'string' && ACCESS_DENIED_PHRASE.test(message.trim())) return 'auth';
  return texts.some(text => HTTP_REASON_PHRASE.test(text.trim())) ? 'invalid_request' : undefined;
}

function providerVerdict(status: number | undefined, codes: string, evidence: string): ProviderFailureKind | undefined {
  if (status === 401 || status === 403 || ACCESS_DENIED_CODE.test(codes)) return 'auth';
  if (status === 402 || BILLING_EXHAUSTED.test(codes)) return 'quota';
  // Token-per-minute limits are 429s whose message asks to shorten the request; waiting is the fix.
  if (status === 429 || RATE_LIMITED.test(codes)) return usageKind(evidence) ?? 'rate_limited';
  if (status === 408 || status === 504 || TIMED_OUT.test(codes)) return 'timeout';
  if ((status !== undefined && status >= 500) || UNAVAILABLE.test(codes)) return 'unavailable';
  if (status === 400 || status === 404 || status === 422 || INVALID_REQUEST_CODE.test(codes)) return 'invalid_request';
  return undefined;
}

// A request the provider named invalid is final; its wording may only say which final kind.
function narrowInvalidRequest(evidence: string, status: number | undefined, codes: string[]): ProviderFailureKind {
  // Anthropic reports an exhausted credit balance as a 400 invalid request.
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  // Claude Max reports an exhausted usage cap as a 400 with no code of its own; a coded rejection, a 404 or a 422 names something else.
  const uncodedRejection = status === 400 && codes.every(code => INVALID_REQUEST_ENVELOPE.test(code));
  if (uncodedRejection && usageKind(evidence) === 'quota') return 'quota';
  return terminalKindFromWording(evidence) ?? 'invalid_request';
}

function usageKind(evidence: string): 'quota' | 'rate_limited' | undefined {
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  if (USAGE_CAPPED.test(evidence)) return RENEWS_WITHIN_THE_HOUR.test(evidence) ? 'rate_limited' : 'quota';
  return undefined;
}

function terminalKindFromWording(evidence: string): ProviderFailureKind | undefined {
  if (ACCESS_DENIED_WORDING.test(evidence)) return 'auth';
  if (CONTEXT_OVERFLOW.some(pattern => pattern.test(evidence))) return 'context_overflow';
  if (MODEL_REJECTED.test(evidence)) return 'model_rejected';
  if (TOOL_HISTORY_REJECTED.test(evidence)) return 'tool_history_rejected';
  if (INVALID_REQUEST_CODE.test(evidence)) return 'invalid_request';
  return undefined;
}

function transientKindFromWording(evidence: string): ProviderFailureKind | undefined {
  if (TIMED_OUT.test(evidence)) return 'timeout';
  if (RATE_LIMITED.test(evidence)) return 'rate_limited';
  if (UNAVAILABLE.test(evidence)) return 'unavailable';
  return undefined;
}

/** The JSON-safe facts worth carrying next to a failure's name and message, on the wire and in history. */
export function providerErrorFacts(error: unknown): ProviderErrorFacts {
  const facts = collectFacts(error);
  const result: ProviderErrorFacts = {};
  if (facts.statusCode !== undefined) result.statusCode = facts.statusCode;
  const codes = [...new Set(facts.codes)];
  if (codes.length > 0) result.codes = codes;
  const message = typeof error === 'object' && error !== null ? readField(error, 'message') : error;
  const reason = innermostReason(error, 0);
  if (reason !== undefined && reason !== (typeof message === 'string' ? message.trim() : undefined))
    result.reason = capPersistedText(reason);
  return result;
}

/** The innermost sentence a provider wrote for a person, unwrapped from envelopes, stringified layers and a wrapped provider response. */
export function providerErrorReason(error: unknown): string | undefined {
  const reason = innermostReason(error, 0);
  return reason === undefined ? undefined : capPersistedText(reason);
}

function innermostReason(error: unknown, depth: number): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || error === null || error === undefined) return undefined;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    const parsed = parseJsonObject(trimmed);
    if (parsed !== undefined) return innermostReason(parsed, depth);
    return !trimmed || HTTP_REASON_PHRASE.test(trimmed) ? undefined : trimmed;
  }
  if (typeof error !== 'object') return undefined;
  for (const key of ['reason', 'detail']) {
    const own = readField(error, key);
    const ownReason = typeof own === 'string' ? innermostReason(own, depth) : undefined;
    if (ownReason) return ownReason;
  }
  for (const key of ['error', 'response', 'data']) {
    const nested = innermostReason(readField(error, key), depth + 1);
    if (nested) return nested;
  }
  const body = readField(error, 'responseBody');
  const bodyReason = typeof body === 'string' ? innermostReason(parseJsonObject(body), depth) : undefined;
  if (bodyReason) return bodyReason;
  const causeReason = reasonBehindCause(readField(error, 'cause'), depth + 1);
  if (causeReason) return causeReason;
  const message = readField(error, 'message');
  return typeof message === 'string' ? innermostReason(message, depth) : undefined;
}

// Walks wrapping causes to the first that holds a provider's HTTP response; any other cause stays out of history.
function reasonBehindCause(cause: unknown, depth: number): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || typeof cause !== 'object' || cause === null) return undefined;
  if (carriesProviderResponse(cause)) return innermostReason(cause, depth);
  return reasonBehindCause(readField(cause, 'cause'), depth + 1);
}

function carriesProviderResponse(value: object): boolean {
  return typeof readField(value, 'statusCode') === 'number' || typeof readField(value, 'responseBody') === 'string';
}
